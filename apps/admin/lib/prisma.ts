import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Note: Slow query metering is available via lib/metering/usage-logger.ts
// For automatic tracking, use the logSlowQuery helper when instrumenting
// specific expensive operations. Prisma middleware-based tracking can be
// added in a future iteration using $extends or query event logging.