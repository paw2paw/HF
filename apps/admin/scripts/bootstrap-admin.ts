/**
 * Bootstrap the first admin user
 *
 * Run with: npx ts-node scripts/bootstrap-admin.ts
 * Or: npm run bootstrap-admin
 *
 * This creates an admin user who can then invite others.
 * The user will be able to sign in via magic link (email).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || "admin@example.com";
  const name = process.argv[3] || "Admin";

  console.log(`\nBootstrapping admin user: ${email}\n`);

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists with role: ${existing.role}`);
    console.log("No changes made.");
    return;
  }

  // Create the admin user
  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: "ADMIN",
      emailVerified: new Date(), // Pre-verify so they can sign in
      isActive: true,
    },
  });

  console.log("Created admin user:");
  console.log(`  ID: ${user.id}`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Name: ${user.name}`);
  console.log(`  Role: ${user.role}`);
  console.log("");
  console.log("This user can now:");
  console.log("  1. Sign in at /login with magic link");
  console.log("  2. Invite other users at /x/users");
  console.log("");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
