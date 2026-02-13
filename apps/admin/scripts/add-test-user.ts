/**
 * Add a test user to the database
 * Run with: npx tsx scripts/add-test-user.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || "test@example.com";
  const name = process.argv[3] || "Test User";
  const password = process.argv[4] || "password123";

  console.log(`Creating user: ${name} <${email}>`);

  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    console.log("❌ User already exists!");
    console.log("Existing user:", existing);
    return;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log("✅ User created successfully!");
  console.log({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  console.log(`\n🔐 Login with:`);
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
