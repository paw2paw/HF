import { requireAuth, isAuthError } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

/**
 * @api GET /api/courses
 * @desc List courses (playbooks) for the current user's domain(s)
 * @auth OPERATOR+
 * @param {string} q - Optional fuzzy search query for course name
 * @returns {object} { courses: Course[], existingCourse?: Course }
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth('OPERATOR');
  if (isAuthError(auth)) return auth.error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  try {
    const query: any = {
      include: {
        domain: { select: { id: true, name: true } },
        _count: { select: { enrollments: true } },
      },
    };

    if (q) {
      // Fuzzy search by name
      query.where = {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { domain: { name: { contains: q, mode: 'insensitive' } } },
        ],
      };
    }

    const playbooks = await prisma.playbook.findMany(query);

    const courses = playbooks.map((pb) => ({
      id: pb.id,
      name: pb.name,
      domain: pb.domain,
      studentCount: pb._count.enrollments,
      status: pb.status.toLowerCase(),
      createdAt: pb.createdAt.toISOString(),
    }));

    // If searching, check for exact match to suggest reuse
    let existingCourse = null;
    if (q && courses.length > 0) {
      existingCourse = courses.find((c) => c.name.toLowerCase() === q.toLowerCase());
    }

    return NextResponse.json({
      courses,
      existingCourse: existingCourse || null,
    });
  } catch (err) {
    console.error('Error fetching courses:', err);
    return NextResponse.json(
      { error: 'Failed to fetch courses' },
      { status: 500 }
    );
  }
}

/**
 * @api POST /api/courses
 * @desc Create a new course (playbook) with initial configuration
 * @auth OPERATOR+
 * @body {object} { domainId, courseName, learningOutcomes, teachingStyle, ... }
 * @returns {object} { course: Course }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth('OPERATOR');
  if (isAuthError(auth)) return auth.error;

  try {
    const body = await request.json();
    const {
      domainId,
      courseName,
      learningOutcomes,
      teachingStyle,
      welcomeMessage,
      studentEmails,
    } = body;

    if (!domainId || !courseName) {
      return NextResponse.json(
        { error: 'Missing required fields: domainId, courseName' },
        { status: 400 }
      );
    }

    // Create the playbook
    const playbook = await prisma.playbook.create({
      data: {
        name: courseName,
        domainId,
        status: 'PUBLISHED',
        description: learningOutcomes?.join('\n') || '',
      },
      include: {
        domain: { select: { id: true, name: true } },
        _count: { select: { enrollments: true } },
      },
    });

    const course = {
      id: playbook.id,
      name: playbook.name,
      domain: playbook.domain,
      studentCount: playbook._count.enrollments,
      status: playbook.status.toLowerCase(),
      createdAt: playbook.createdAt.toISOString(),
    };

    return NextResponse.json({ course });
  } catch (err) {
    console.error('Error creating course:', err);
    return NextResponse.json(
      { error: 'Failed to create course' },
      { status: 500 }
    );
  }
}
