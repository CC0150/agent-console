import type { Task, Workspace } from "@agent-console/contracts";
import { taskRepository, workspaceRepository } from "./repositories";

/**
 * 测试数据跟踪器：只清理当前测试文件创建的数据，避免影响已迁移的生产数据。
 */
export class TestData {
  private readonly taskIds: string[] = [];
  private readonly workspaceIds: string[] = [];

  async createTask(input: {
    goal: string;
    model?: string;
    workspaceId?: string;
  }): Promise<Task> {
    const task = await taskRepository.create({
      goal: input.goal,
      model: input.model ?? "mock",
      workspaceId: input.workspaceId,
    });
    this.taskIds.push(task.id);
    return task;
  }

  async createWorkspace(name: string): Promise<Workspace> {
    const workspace = await workspaceRepository.create({
      name,
      description: "测试工作区",
    });
    this.workspaceIds.push(workspace.id);
    return workspace;
  }

  async removeCreatedTasks(): Promise<void> {
    for (const id of this.taskIds.splice(0)) {
      await taskRepository.remove(id);
    }
  }

  async cleanup(): Promise<void> {
    await this.removeCreatedTasks();
    for (const id of this.workspaceIds.splice(0)) {
      await workspaceRepository.remove(id);
    }
  }
}
