/**
 * Image Extraction from Documents
 *
 * Extracts embedded images/figures from PDFs and DOCX files.
 * Creates MediaAsset records linked to the ContentSource and Subject.
 *
 * PDF: Uses pdfjs-dist operator list to find embedded image XObjects.
 * DOCX: Uses mammoth's convertImage callback to intercept embedded images.
 *
 * Extracted images are stored via the pluggable storage adapter (GCS/local)
 * and linked to subjects via SubjectMedia for content catalog visibility.
 */

import { prisma } from "@/lib/prisma";
import { getStorageAdapter, computeContentHash } from "@/lib/storage";
import { storageKeyFromHash, extensionFromMime } from "@/lib/storage/utils";
import { detectFigureRefs } from "./filter-sections";

// ── Types ──────────────────────────────────────────────

export interface ExtractedImage {
  mediaId: string;
  pageNumber?: number;
  positionIndex: number;
  captionText?: string;
  figureRef?: string;
  contentHash: string;
  mimeType: string;
}

export interface ImageExtractionResult {
  ok: boolean;
  images: ExtractedImage[];
  warnings: string[];
}

// Settings from system-settings (single source of truth)
import {
  type ImageExtractionSettings,
  IMAGE_EXTRACTION_DEFAULTS,
} from "@/lib/system-settings";
export { type ImageExtractionSettings, IMAGE_EXTRACTION_DEFAULTS };

// ── Caption Detection ──────────────────────────────────

/**
 * Extract figure captions from document text.
 * Matches patterns like "Figure 1.2: caption text" or "Fig. 3 — description"
 * Returns a map of normalized figure ref → caption text.
 */
export function extractCaptionsFromText(text: string): Map<string, string> {
  const captions = new Map<string, string>();

  const patterns = [
    // "Figure 1.2: caption text" or "Figure 1.2 — caption text"
    /(?:Figure|Fig\.?)\s+(\d+(?:\.\d+)*[a-z]?)\s*[:—–\-]\s*(.+?)(?:\n|$)/gi,
    // "Diagram A: description"
    /(?:Diagram|Chart|Graph|Table|Illustration)\s+(\d+(?:\.\d+)*[a-z]?)\s*[:—–\-]\s*(.+?)(?:\n|$)/gi,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const fullRef = match[0].split(/[:—–\-]/)[0].trim();
      const captionText = match[2].trim();
      if (captionText.length > 3 && captionText.length < 300) {
        captions.set(normalizeFigureRef(fullRef), captionText);
      }
    }
  }

  return captions;
}

/**
 * Normalize a figure reference for matching.
 * "Fig. 1.2" → "figure 1.2", "FIGURE 1" → "figure 1"
 */
export function normalizeFigureRef(ref: string): string {
  return ref
    .toLowerCase()
    .replace(/^(?:figure|fig\.?)\s*/i, "figure ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── PDF Image Extraction ───────────────────────────────

/**
 * Extract embedded images from a PDF buffer.
 * Uses pdfjs-dist to inspect each page's operator list for image XObjects.
 */
export async function extractImagesFromPdf(
  buffer: Buffer,
  sourceId: string,
  userId: string,
  settings: ImageExtractionSettings = IMAGE_EXTRACTION_DEFAULTS,
): Promise<ImageExtractionResult> {
  const warnings: string[] = [];
  const images: ExtractedImage[] = [];

  if (!settings.enabled) {
    return { ok: true, images: [], warnings: ["Image extraction disabled"] };
  }

  try {
    // Dynamic import to avoid bundling issues
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      // Disable font/image rendering that requires canvas
      isEvalSupported: false,
    }).promise;

    const numPages = doc.numPages;
    let totalImagesFound = 0;

    // Also extract text for caption detection
    let fullText = "";
    const pageTexts: Map<number, string> = new Map();

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      if (images.length >= settings.maxImagesPerDocument) {
        warnings.push(
          `Reached max images limit (${settings.maxImagesPerDocument}). ` +
          `Stopped after page ${pageNum - 1} of ${numPages}.`,
        );
        break;
      }

      const page = await doc.getPage(pageNum);

      // Get page text for caption detection
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => ("str" in item ? item.str : ""))
        .join(" ");
      pageTexts.set(pageNum, pageText);
      fullText += pageText + "\n";

      // Get operator list to find image operations
      const opList = await page.getOperatorList();
      let pageImageIndex = 0;

      for (let i = 0; i < opList.fnArray.length; i++) {
        const op = opList.fnArray[i];

        // Check for image painting operations (v5: paintImageXObject covers all types)
        if (
          op !== pdfjsLib.OPS.paintImageXObject &&
          op !== pdfjsLib.OPS.paintInlineImageXObject
        ) {
          continue;
        }

        totalImagesFound++;

        if (images.length >= settings.maxImagesPerDocument) break;

        const imgName = opList.argsArray[i][0];

        // Inline images have data directly in args, not as named objects
        if (op === pdfjsLib.OPS.paintInlineImageXObject) {
          // Inline image: args[0] is the image data object directly
          const inlineImg = imgName;
          if (inlineImg?.data && inlineImg.width && inlineImg.height) {
            try {
              const imageBuffer = await encodeRawImageAsPng(
                inlineImg.data, inlineImg.width, inlineImg.height, inlineImg.kind,
              );
              if (imageBuffer.length >= settings.minImageSizeBytes) {
                const extracted = await storeExtractedImage(imageBuffer, "image/png", {
                  sourceId, userId, pageNumber: pageNum,
                  positionIndex: pageImageIndex, extractedFrom: "pdf",
                  fileName: `page${pageNum}_inline${pageImageIndex}.png`,
                });
                if (extracted) images.push(extracted);
                pageImageIndex++;
              }
            } catch { /* skip failed inline image */ }
          }
          continue;
        }

        // Named XObject image
        try {
          // Get the image object from the page
          const imgObj: any = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Image obj timeout")), 5000);
            page.objs.get(imgName, (obj: any) => {
              clearTimeout(timeout);
              resolve(obj);
            });
          });

          if (!imgObj) {
            warnings.push(`Page ${pageNum}: Image "${imgName}" returned null`);
            continue;
          }

          let imageBuffer: Buffer;
          let mimeType: string;

          if (imgObj.data && imgObj.width && imgObj.height) {
            // Raw pixel data — encode as PNG
            imageBuffer = await encodeRawImageAsPng(
              imgObj.data,
              imgObj.width,
              imgObj.height,
              imgObj.kind, // 1=GRAYSCALE, 2=RGB, 3=RGBA
            );
            mimeType = "image/png";
          } else {
            warnings.push(`Page ${pageNum}: Image "${imgName}" has no extractable data`);
            continue;
          }

          // Skip tiny images (icons, bullets, etc.)
          if (imageBuffer.length < settings.minImageSizeBytes) {
            continue;
          }

          // Create MediaAsset
          const extracted = await storeExtractedImage(imageBuffer, mimeType, {
            sourceId,
            userId,
            pageNumber: pageNum,
            positionIndex: pageImageIndex,
            extractedFrom: "pdf",
            fileName: `page${pageNum}_img${pageImageIndex}.${extensionFromMime(mimeType)}`,
          });

          if (extracted) {
            images.push(extracted);
          }

          pageImageIndex++;
        } catch (imgErr: any) {
          warnings.push(`Page ${pageNum}: Failed to extract image "${imgName}": ${imgErr.message}`);
        }
      }

      page.cleanup();
    }

    doc.destroy();

    // Caption detection pass
    if (settings.captionDetection && images.length > 0) {
      const captions = extractCaptionsFromText(fullText);
      assignCaptionsToImages(images, captions, pageTexts);
    }

    if (totalImagesFound > 0 && images.length === 0) {
      warnings.push(
        `Found ${totalImagesFound} images but all were below minimum size (${settings.minImageSizeBytes} bytes)`,
      );
    }

    return { ok: true, images, warnings };
  } catch (err: any) {
    return {
      ok: false,
      images,
      warnings: [...warnings, `PDF image extraction failed: ${err.message}`],
    };
  }
}

// ── DOCX Image Extraction ──────────────────────────────

/**
 * Extract embedded images from a DOCX buffer.
 * Uses mammoth's convertImage callback to intercept each embedded image.
 */
export async function extractImagesFromDocx(
  buffer: Buffer,
  sourceId: string,
  userId: string,
  settings: ImageExtractionSettings = IMAGE_EXTRACTION_DEFAULTS,
): Promise<ImageExtractionResult> {
  const warnings: string[] = [];
  const images: ExtractedImage[] = [];

  if (!settings.enabled) {
    return { ok: true, images: [], warnings: ["Image extraction disabled"] };
  }

  try {
    const mammoth = await import("mammoth");
    let positionIndex = 0;

    // Use mammoth's HTML conversion with image interception
    const _result = await mammoth.convertToHtml(
      { buffer },
      {
        convertImage: mammoth.images.imgElement((image: any) => {
          return image.read("base64").then(async (base64Data: string) => {
            if (images.length >= settings.maxImagesPerDocument) {
              return { src: "" };
            }

            const contentType = image.contentType || "image/png";
            const imageBuffer = Buffer.from(base64Data, "base64");

            // Skip tiny images
            if (imageBuffer.length < settings.minImageSizeBytes) {
              return { src: "" };
            }

            try {
              const extracted = await storeExtractedImage(imageBuffer, contentType, {
                sourceId,
                userId,
                positionIndex,
                extractedFrom: "docx",
                fileName: `docx_img${positionIndex}.${extensionFromMime(contentType)}`,
              });

              if (extracted) {
                images.push(extracted);
              }
            } catch (err: any) {
              warnings.push(`DOCX image ${positionIndex}: ${err.message}`);
            }

            positionIndex++;
            return { src: "" }; // We don't need the HTML output
          });
        }),
      },
    );

    // Also extract text for caption detection
    if (settings.captionDetection && images.length > 0) {
      const textResult = await mammoth.extractRawText({ buffer });
      const captions = extractCaptionsFromText(textResult.value);
      assignCaptionsToImages(images, captions, new Map());
    }

    return { ok: true, images, warnings };
  } catch (err: any) {
    return {
      ok: false,
      images,
      warnings: [...warnings, `DOCX image extraction failed: ${err.message}`],
    };
  }
}

// ── Shared Helpers ─────────────────────────────────────

/**
 * Encode raw pixel data (RGBA/RGB/Grayscale) as PNG using pngjs.
 */
async function encodeRawImageAsPng(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  kind?: number, // 1=GRAYSCALE, 2=RGB, 3=RGBA
): Promise<Buffer> {
  const { PNG } = await import("pngjs");
  const png = new PNG({ width, height });

  // Convert to RGBA regardless of input kind
  const channels = kind === 1 ? 1 : kind === 2 ? 3 : 4;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * channels;
      const dstIdx = (y * width + x) * 4;

      if (channels === 1) {
        // Grayscale → RGBA
        png.data[dstIdx] = data[srcIdx];
        png.data[dstIdx + 1] = data[srcIdx];
        png.data[dstIdx + 2] = data[srcIdx];
        png.data[dstIdx + 3] = 255;
      } else if (channels === 3) {
        // RGB → RGBA
        png.data[dstIdx] = data[srcIdx];
        png.data[dstIdx + 1] = data[srcIdx + 1];
        png.data[dstIdx + 2] = data[srcIdx + 2];
        png.data[dstIdx + 3] = 255;
      } else {
        // RGBA → RGBA
        png.data[dstIdx] = data[srcIdx];
        png.data[dstIdx + 1] = data[srcIdx + 1];
        png.data[dstIdx + 2] = data[srcIdx + 2];
        png.data[dstIdx + 3] = data[srcIdx + 3];
      }
    }
  }

  return PNG.sync.write(png);
}

/**
 * Store an extracted image as a MediaAsset record.
 * Handles deduplication via content hash.
 */
async function storeExtractedImage(
  imageBuffer: Buffer,
  mimeType: string,
  opts: {
    sourceId: string;
    userId: string;
    pageNumber?: number;
    positionIndex: number;
    extractedFrom: string;
    fileName: string;
  },
): Promise<ExtractedImage | null> {
  const contentHash = computeContentHash(imageBuffer);

  // Check for dedup — same image already extracted
  const existing = await prisma.mediaAsset.findUnique({
    where: { contentHash },
    select: { id: true },
  });

  if (existing) {
    return {
      mediaId: existing.id,
      pageNumber: opts.pageNumber,
      positionIndex: opts.positionIndex,
      contentHash,
      mimeType,
    };
  }

  // Upload to storage
  const storage = getStorageAdapter();
  const storageKey = storageKeyFromHash(contentHash, mimeType);
  await storage.upload(imageBuffer, {
    fileName: opts.fileName,
    mimeType,
    contentHash,
  });

  // Create MediaAsset record
  const media = await prisma.mediaAsset.create({
    data: {
      fileName: opts.fileName,
      fileSize: imageBuffer.length,
      mimeType,
      contentHash,
      storageKey,
      storageType: "local", // Will be overridden by adapter if GCS
      uploadedBy: opts.userId,
      sourceId: opts.sourceId,
      pageNumber: opts.pageNumber ?? null,
      positionIndex: opts.positionIndex,
      extractedFrom: opts.extractedFrom,
      trustLevel: "UNVERIFIED",
    },
  });

  return {
    mediaId: media.id,
    pageNumber: opts.pageNumber,
    positionIndex: opts.positionIndex,
    contentHash,
    mimeType,
  };
}

/**
 * Assign detected captions to extracted images by matching figure references.
 * Also detects figure references from page text near each image.
 */
function assignCaptionsToImages(
  images: ExtractedImage[],
  captions: Map<string, string>,
  pageTexts: Map<number, string>,
): void {
  for (const img of images) {
    // Try to find figure reference from page text
    if (img.pageNumber && pageTexts.has(img.pageNumber)) {
      const pageText = pageTexts.get(img.pageNumber)!;
      const refs = detectFigureRefs(pageText);
      // Assign the figure ref that matches the image position
      // (first ref for first image on page, etc.)
      if (refs.length > 0) {
        const refIndex = Math.min(img.positionIndex, refs.length - 1);
        img.figureRef = refs[refIndex];
      }
    }

    // Match caption by figure ref
    if (img.figureRef) {
      const normalized = normalizeFigureRef(img.figureRef);
      captions.forEach((caption, key) => {
        if (!img.captionText && (key === normalized || key.includes(normalized) || normalized.includes(key))) {
          img.captionText = caption;
        }
      });
    }
  }
}

/**
 * Link extracted images to a subject's media library.
 * Creates SubjectMedia junction records so images appear in the content catalog.
 */
export async function linkImagesToSubject(
  sourceId: string,
  images: ExtractedImage[],
): Promise<number> {
  if (images.length === 0) return 0;

  // Find subjects linked to this content source
  const subjectSources = await prisma.subjectSource.findMany({
    where: { sourceId },
    select: { subjectId: true },
  });

  if (subjectSources.length === 0) return 0;

  let linked = 0;
  for (const { subjectId } of subjectSources) {
    for (const img of images) {
      try {
        await prisma.subjectMedia.upsert({
          where: {
            subjectId_mediaId: { subjectId, mediaId: img.mediaId },
          },
          create: {
            subjectId,
            mediaId: img.mediaId,
            sortOrder: img.positionIndex,
          },
          update: {},
        });
        linked++;
      } catch {
        // Ignore duplicate errors
      }
    }
  }

  return linked;
}

/**
 * Update MediaAsset records with detected captions and figure refs.
 * Called after caption detection pass completes.
 */
export async function persistImageMetadata(images: ExtractedImage[]): Promise<void> {
  for (const img of images) {
    if (img.captionText || img.figureRef) {
      await prisma.mediaAsset.update({
        where: { id: img.mediaId },
        data: {
          captionText: img.captionText || undefined,
          figureRef: img.figureRef || undefined,
          title: img.captionText
            ? img.captionText.slice(0, 100)
            : img.figureRef || undefined,
        },
      });
    }
  }
}
