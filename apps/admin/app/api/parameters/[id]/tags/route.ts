import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/parameters/:id/tags
 * Add a tag to a parameter
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { tagName } = body;

    if (!tagName) {
      return NextResponse.json(
        { error: 'tagName is required' },
        { status: 400 }
      );
    }

    // Get the parameter to find its parameterId
    const parameter = await prisma.parameter.findUnique({
      where: { id }
    });

    if (!parameter) {
      return NextResponse.json(
        { error: 'Parameter not found' },
        { status: 404 }
      );
    }

    // Find or create the tag
    let tag = await prisma.tag.findUnique({
      where: { name: tagName }
    });

    if (!tag) {
      // Create the tag if it doesn't exist
      tag = await prisma.tag.create({
        data: {
          id: tagName.toLowerCase(),
          name: tagName,
          slug: tagName.toLowerCase()
        }
      });
    }

    // Create the parameter-tag relationship if it doesn't exist
    const existingLink = await prisma.parameterTag.findUnique({
      where: {
        parameterId_tagId: {
          parameterId: parameter.parameterId,
          tagId: tag.id
        }
      }
    });

    if (!existingLink) {
      await prisma.parameterTag.create({
        data: {
          id: `${parameter.parameterId}-${tag.id}`,
          parameterId: parameter.parameterId,
          tagId: tag.id
        }
      });
    }

    // Return updated parameter with tags
    const updatedParameter = await prisma.parameter.findUnique({
      where: { id },
      include: {
        tags: {
          include: {
            tag: true
          }
        }
      }
    });

    return NextResponse.json(updatedParameter);
  } catch (error: any) {
    const { id } = await params;
    console.error(`POST /api/parameters/${id}/tags error:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to add tag' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/parameters/:id/tags
 * Remove a tag from a parameter
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const tagName = searchParams.get('tagName');

    if (!tagName) {
      return NextResponse.json(
        { error: 'tagName query parameter is required' },
        { status: 400 }
      );
    }

    // Get the parameter
    const parameter = await prisma.parameter.findUnique({
      where: { id }
    });

    if (!parameter) {
      return NextResponse.json(
        { error: 'Parameter not found' },
        { status: 404 }
      );
    }

    // Find the tag
    const tag = await prisma.tag.findUnique({
      where: { name: tagName }
    });

    if (!tag) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }

    // Delete the parameter-tag relationship
    await prisma.parameterTag.deleteMany({
      where: {
        parameterId: parameter.parameterId,
        tagId: tag.id
      }
    });

    // Return updated parameter with tags
    const updatedParameter = await prisma.parameter.findUnique({
      where: { id },
      include: {
        tags: {
          include: {
            tag: true
          }
        }
      }
    });

    return NextResponse.json(updatedParameter);
  } catch (error: any) {
    const { id } = await params;
    console.error(`DELETE /api/parameters/${id}/tags error:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to remove tag' },
      { status: 500 }
    );
  }
}
