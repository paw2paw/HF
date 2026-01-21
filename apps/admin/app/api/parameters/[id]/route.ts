import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/parameters/:id
 * React-Admin getOne endpoint
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parameter = await prisma.parameter.findUnique({
      where: { id },
      include: {
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

    if (!parameter) {
      return NextResponse.json(
        { error: 'Parameter not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(parameter);
  } catch (error: any) {
    const { id } = await params;
    console.error(`GET /api/parameters/${id} error:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch parameter' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/parameters/:id
 * React-Admin update endpoint
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const parameter = await prisma.parameter.update({
      where: { id },
      data: {
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
        // parameterId is immutable, don't update it
        // Note: isMvpCore and isActive are managed via tags, not direct fields
      },
      include: {
        tags: {
          include: {
            tag: true
          }
        }
      }
    });

    return NextResponse.json(parameter);
  } catch (error: any) {
    const { id } = await params;
    console.error(`PUT /api/parameters/${id} error:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to update parameter' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/parameters/:id
 * React-Admin delete endpoint
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parameter = await prisma.parameter.delete({
      where: { id },
    });

    return NextResponse.json(parameter);
  } catch (error: any) {
    const { id } = await params;
    console.error(`DELETE /api/parameters/${id} error:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete parameter' },
      { status: 500 }
    );
  }
}
