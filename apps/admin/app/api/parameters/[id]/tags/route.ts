import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api POST /api/parameters/:id/tags
 * @visibility internal
 * @scope parameters:write
 * @auth session
 * @tags parameters
 * @description Add a tag to a parameter. Creates the tag if it does not exist. Idempotent (no error if link already exists).
 * @pathParam id string - Parameter UUID
 * @body tagName string - Tag name to add (required)
 * @response 200 Parameter (with updated tags)
 * @response 400 { error: "tagName is required" }
 * @response 404 { error: "Parameter not found" }
 * @response 500 { error: "..." }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

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
 * @api DELETE /api/parameters/:id/tags
 * @visibility internal
 * @scope parameters:write
 * @auth session
 * @tags parameters
 * @description Remove a tag from a parameter
 * @pathParam id string - Parameter UUID
 * @query tagName string - Tag name to remove (required)
 * @response 200 Parameter (with updated tags)
 * @response 400 { error: "tagName query parameter is required" }
 * @response 404 { error: "Parameter not found" }
 * @response 404 { error: "Tag not found" }
 * @response 500 { error: "..." }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

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
