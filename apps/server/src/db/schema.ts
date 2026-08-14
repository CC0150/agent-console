import { connectDatabase, prisma } from "./client";

/**
 * 表结构由 Prisma migrations 管理，这里只确保连接可用并补默认工作区。
 */
export async function migrate(): Promise<void> {
  await connectDatabase();

  const existing = await prisma.workspace.findUnique({ where: { id: "default" } });
  if (existing) {
    return;
  }

  const now = new Date().toISOString();
  await prisma.workspace.create({
    data: {
      id: "default",
      name: "默认工作区",
      description: "系统默认工作区",
      createdAt: now,
      updatedAt: now,
    },
  });
}
