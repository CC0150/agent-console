import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const schema = process.env.DATABASE_SCHEMA;
const adapter = new PrismaPg(
  { connectionString },
  schema ? { schema } : undefined,
);

export const prisma = new PrismaClient({ adapter });

let databaseReady = false;

export async function connectDatabase(): Promise<void> {
  if (databaseReady) {
    return;
  }
  await prisma.$connect();
  databaseReady = true;
}

export async function closeDatabase(): Promise<void> {
  await prisma.$disconnect();
  databaseReady = false;
}

export function isDatabaseOpen(): boolean {
  return databaseReady;
}
