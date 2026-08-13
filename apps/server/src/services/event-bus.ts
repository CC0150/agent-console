import type { TaskEvent } from "@agent-console/contracts";

type Subscriber = (event: TaskEvent) => void;

class EventBus {
  private readonly subscribers = new Map<string, Set<Subscriber>>();

  subscribe(taskId: string, subscriber: Subscriber): () => void {
    const existing = this.subscribers.get(taskId) ?? new Set<Subscriber>();
    existing.add(subscriber);
    this.subscribers.set(taskId, existing);
    return () => {
      existing.delete(subscriber);
      if (existing.size === 0) {
        this.subscribers.delete(taskId);
      }
    };
  }

  publish(event: TaskEvent): void {
    const subscribers = this.subscribers.get(event.taskId);
    if (!subscribers) {
      return;
    }
    for (const subscriber of subscribers) {
      try {
        subscriber(event);
      } catch (error) {
        console.error("事件订阅者执行失败", error);
      }
    }
  }
}

export const eventBus = new EventBus();
