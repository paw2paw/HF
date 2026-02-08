import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/parameters
 * React-Admin getList endpoint
 *
 * Query params:
 * - sort: JSON array [field, order] e.g. ["parameterId", "ASC"]
 * - range: JSON array [start, end] e.g. [0, 24]
 * - filter: JSON object e.g. {"q": "search term"}
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.url ? new URL(request.url) : { searchParams: new URLSearchParams() };

    // Parse React-Admin query params
    const sortParam = searchParams.get("sort");
    const rangeParam = searchParams.get("range");
    const filterParam = searchParams.get("filter");

    const sort = sortParam ? JSON.parse(sortParam) : ["parameterId", "ASC"];
    const range = rangeParam ? JSON.parse(rangeParam) : [0, 24];
    const filter = filterParam ? JSON.parse(filterParam) : {};

    const [sortField, sortOrder] = sort;
    const [start, end] = range;
    const limit = end - start + 1;

    // Build where clause for filtering
    const where: any = {};

    // Search filter (searches across multiple fields)
    if (filter.q) {
      where.OR = [
        { parameterId: { contains: filter.q, mode: 'insensitive' } },
        { name: { contains: filter.q, mode: 'insensitive' } },
        { domainGroup: { contains: filter.q, mode: 'insensitive' } },
        { sectionId: { contains: filter.q, mode: 'insensitive' } },
      ];
    }

    // Boolean filters
    if (typeof filter.isActive === 'boolean') {
      where.isActive = filter.isActive;
    }
    if (typeof filter.isMvpCore === 'boolean') {
      where.isMvpCore = filter.isMvpCore;
    }

    // Parameter type filter
    if (filter.parameterType) {
      where.parameterType = filter.parameterType;
    }

    // Get total count
    const total = await prisma.parameter.count({ where });

    // Get paginated data with tags, prompt slug links, and source feature set
    const data = await prisma.parameter.findMany({
      where,
      orderBy: { [sortField]: sortOrder.toLowerCase() },
      skip: start,
      take: limit,
      include: {
        sourceFeatureSet: {
          select: { id: true, featureId: true, name: true, version: true }
        },
        tags: {
          include: {
            tag: true
          }
        },
        promptSlugLinks: {
          include: {
            slug: {
              select: {
                id: true,
                slug: true,
                name: true,
                sourceType: true,
                isActive: true
              }
            }
          }
        }
      }
    });

    // React-Admin expects Content-Range header for pagination
    const response = NextResponse.json(data);
    response.headers.set('Content-Range', `parameters ${start}-${end}/${total}`);
    response.headers.set('Access-Control-Expose-Headers', 'Content-Range');

    return response;
  } catch (error: any) {
    console.error('GET /api/parameters error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch parameters' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/parameters
 * React-Admin create endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parameter = await prisma.parameter.create({
      data: {
        parameterId: body.parameterId,
        name: body.name || null,
        domainGroup: body.domainGroup || null,
        sectionId: body.sectionId || null,
        scaleType: body.scaleType || null,
        directionality: body.directionality || null,
        computedBy: body.computedBy || null,
        definition: body.definition || null,
        interpretationLow: body.interpretationLow || null,
        interpretationHigh: body.interpretationHigh || null,
        measurementMvp: body.measurementMvp || null,
        measurementVoiceOnly: body.measurementVoiceOnly || null,
        // Note: isMvpCore and isActive are managed via tags, not direct fields
      },
    });

    return NextResponse.json(parameter, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/parameters error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create parameter' },
      { status: 500 }
    );
  }
}
