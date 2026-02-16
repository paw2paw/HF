import { logExternalAPIUsage } from "@/lib/metering";

const DEFAULT_MODEL = "text-embedding-3-small";
const DEFAULT_BATCH_SIZE = 100;

/**
 * Call OpenAI embeddings API for a batch of texts.
 * Returns one float[] per input text, in order.
 */
export async function openAiEmbed(
  texts: string[],
  model: string = DEFAULT_MODEL
): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, input: texts }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`OpenAI embeddings failed: ${res.status} ${msg}`);
  }

  const json = (await res.json()) as any;
  const data = Array.isArray(json?.data) ? json.data : [];

  await logExternalAPIUsage({
    operation: "openai-embedding",
    metadata: { model, inputCount: texts.length, dimensions: data[0]?.embedding?.length },
  });

  return data.map((d: any) => d.embedding as number[]);
}

/** Embed a single text string. Returns the embedding vector. */
export async function embedText(
  text: string,
  model: string = DEFAULT_MODEL
): Promise<number[]> {
  const [embedding] = await openAiEmbed([text], model);
  if (!embedding) throw new Error("No embedding returned");
  return embedding;
}

/**
 * Embed multiple texts in batches.
 * Returns one embedding per input text, preserving order.
 */
export async function embedTexts(
  texts: string[],
  batchSize: number = DEFAULT_BATCH_SIZE,
  model: string = DEFAULT_MODEL
): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddings = await openAiEmbed(batch, model);
    results.push(...embeddings);
  }

  return results;
}

/**
 * Format a float[] as a pgvector literal string: "[0.1,0.2,...]"
 * Used in $queryRaw to cast to vector type.
 */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
