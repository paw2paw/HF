import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encode } from "next-auth/jwt";
import { validateBody, joinPostSchema } from "@/lib/validation";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";

/**
 * @api GET /api/join/[token]
 * @visibility public
 * @auth none
 * @description Verify a classroom join token. Returns classroom info if valid.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const cohort = await prisma.cohortGroup.findUnique({
    where: { joinToken: token },
    include: {
      domain: { select: { name: true, onboardingWelcome: true } },
      owner: { select: { name: true } },
      institution: {
        select: {
          name: true,
          logoUrl: true,
          primaryColor: true,
          secondaryColor: true,
          welcomeMessage: true,
        },
      },
      _count: { select: { members: true } },
    },
  });

  if (!cohort || !cohort.isActive) {
    return NextResponse.json(
      { ok: false, error: "Invalid or expired join link" },
      { status: 404 }
    );
  }

  // Check expiry if set
  if ((cohort as any).joinTokenExp && new Date((cohort as any).joinTokenExp) < new Date()) {
    return NextResponse.json(
      { ok: false, error: "This join link has expired" },
      { status: 410 }
    );
  }

  return NextResponse.json({
    ok: true,
    classroom: {
      name: cohort.name,
      domain: cohort.domain.name,
      teacher: cohort.owner.name ?? "Your teacher",
      memberCount: cohort._count.members,
      institutionName: cohort.institution?.name ?? null,
      institutionLogo: cohort.institution?.logoUrl ?? null,
      institutionPrimaryColor: cohort.institution?.primaryColor ?? null,
      institutionWelcome: cohort.institution?.welcomeMessage ?? null,
      domainWelcome: cohort.domain.onboardingWelcome ?? null,
    },
  });
}

/**
 * @api POST /api/join/[token]
 * @visibility public
 * @auth none
 * @description Accept a classroom join link. Creates User + Caller + sets session.
 * @body firstName string (required)
 * @body lastName string (required)
 * @body email string (required)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const rl = checkRateLimit(getClientIP(request), "join");
  if (!rl.ok) return rl.error;

  const { token } = await params;
  const body = await request.json();
  const v = validateBody(joinPostSchema, body);
  if (!v.ok) return v.error;
  const { firstName, lastName, email } = v.data;

  const cohort = await prisma.cohortGroup.findUnique({
    where: { joinToken: token },
    include: {
      domain: { select: { id: true } },
    },
  });

  if (!cohort || !cohort.isActive) {
    return NextResponse.json(
      { ok: false, error: "Invalid or expired join link" },
      { status: 404 }
    );
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  if (existingUser) {
    // User exists — check if they already have a caller in this cohort
    const existingCaller = await prisma.caller.findFirst({
      where: { userId: existingUser.id, cohortGroupId: cohort.id },
    });

    if (existingCaller) {
      // Generic message — still helpful for the user but doesn't confirm email existence to attackers
      return NextResponse.json(
        { ok: false, error: "This email is already associated with this classroom", redirect: "/login" },
        { status: 409 }
      );
    }

    // Add existing user to this cohort
    await prisma.caller.create({
      data: {
        name: `${firstName.trim()} ${lastName.trim()}`,
        email: email.trim().toLowerCase(),
        role: "LEARNER",
        userId: existingUser.id,
        domainId: cohort.domainId,
        cohortGroupId: cohort.id,
        externalId: `join-${existingUser.id}-${cohort.id}`,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Joined classroom",
      redirect: "/x/student/progress",
    });
  }

  // Create new user + caller in one transaction
  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: email.trim().toLowerCase(),
        name: `${firstName.trim()} ${lastName.trim()}`,
        displayName: firstName.trim(),
        role: "STUDENT",
        emailVerified: new Date(),
        isActive: true,
        assignedDomainId: cohort.domainId,
        institutionId: cohort.institutionId,
      },
    });

    await tx.caller.create({
      data: {
        name: `${firstName.trim()} ${lastName.trim()}`,
        email: email.trim().toLowerCase(),
        role: "LEARNER",
        userId: newUser.id,
        domainId: cohort.domainId,
        cohortGroupId: cohort.id,
        externalId: `join-${newUser.id}`,
      },
    });

    return newUser;
  });

  // Auto sign-in via JWT cookie
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "Server configuration error" },
      { status: 500 }
    );
  }

  const jwtToken = await encode({
    token: {
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    secret,
    salt: "authjs.session-token",
    maxAge: 30 * 24 * 60 * 60,
  });

  const response = NextResponse.json({
    ok: true,
    message: "Welcome! You've joined the classroom.",
    redirect: "/x/student/progress",
  });

  const isProduction = process.env.NODE_ENV === "production";
  const cookieName = isProduction
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  response.cookies.set(cookieName, jwtToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return response;
}
