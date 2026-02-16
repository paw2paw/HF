import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { sendMagicLinkEmail } from "./email";
import type { UserRole } from "@prisma/client";
import type { Adapter } from "next-auth/adapters";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      image: string | null;
      role: UserRole;
      assignedDomainId: string | null;
    };
  }

  interface User {
    role: UserRole;
    assignedDomainId?: string | null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: "jwt", // JWT for credentials support
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
    error: "/login/error",
  },
  providers: [
    // Password login (for dev/demo - no email setup needed)
    CredentialsProvider({
      name: "Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("[Auth] Authorize called with:", credentials?.email);

        if (!credentials?.email || !credentials?.password) {
          console.log("[Auth] Missing credentials");
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        console.log("[Auth] User found:", user?.email, "active:", user?.isActive);

        if (!user || !user.isActive) {
          console.log("[Auth] User not found or inactive");
          return null;
        }

        // Check password
        if (user.passwordHash) {
          const valid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash
          );
          if (!valid) {
            console.log("[Auth] Password hash check failed");
            return null;
          }
        } else {
          // No password set — password auth unavailable for this user.
          // Use magic link or set SEED_ADMIN_PASSWORD in seed script.
          console.log("[Auth] No passwordHash set, password auth unavailable");
          return null;
        }

        // Password is a one-time bootstrap credential — clear it so future
        // logins must use magic-link. Fire-and-forget (don't block auth).
        prisma.user
          .update({ where: { id: user.id }, data: { passwordHash: null } })
          .then(() => console.log("[Auth] Cleared passwordHash for", user.email))
          .catch((e) => console.error("[Auth] Failed to clear passwordHash:", e));

        console.log("[Auth] Success, returning user");
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          assignedDomainId: user.assignedDomainId,
        };
      },
    }),
    // Magic link (when email is configured)
    EmailProvider({
      server: {
        host: process.env.SMTP_HOST || "smtp.resend.com",
        port: parseInt(process.env.SMTP_PORT || "587"),
        auth: {
          user: process.env.SMTP_USER || "resend",
          pass: process.env.SMTP_PASSWORD || process.env.RESEND_API_KEY || "",
        },
      },
      from: process.env.EMAIL_FROM || "HF Admin <noreply@example.com>",
      sendVerificationRequest: async ({ identifier: email, url }) => {
        await sendMagicLinkEmail({ to: email, url });
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      console.log("[Auth signIn callback] provider:", account?.provider, "user:", user?.email);

      // Credentials provider handles its own validation
      if (account?.provider === "credentials") {
        console.log("[Auth signIn callback] Credentials - allowing");
        return true;
      }

      if (!user.email) return false;

      // Check if user has a valid invite or already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      if (existingUser) {
        // Existing user - allow sign in if active
        return existingUser.isActive;
      }

      // New user - check for valid invite
      const invite = await prisma.invite.findFirst({
        where: {
          email: user.email,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (!invite) {
        // No valid invite - deny signup
        return false;
      }

      return true;
    },

    async jwt({ token, user }) {
      // On sign in, add user info to token
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.assignedDomainId = user.assignedDomainId ?? null;
      }
      return token;
    },

    async session({ session, token }) {
      // For JWT sessions, get user info from token
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.assignedDomainId = (token.assignedDomainId as string) ?? null;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.email) return;

      // Find and consume the invite, apply the role
      const invite = await prisma.invite.findFirst({
        where: {
          email: user.email,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (invite) {
        await prisma.$transaction([
          // Mark invite as used
          prisma.invite.update({
            where: { id: invite.id },
            data: { usedAt: new Date() },
          }),
          // Apply the role from the invite
          prisma.user.update({
            where: { id: user.id },
            data: { role: invite.role },
          }),
        ]);
      }
    },
  },
});
