import { create } from "zustand";
import type { TaskEvent } from "@agent-console/contracts";
import { openTaskStream } from "../lib/sse";

type ConnectionState = "idle" | "connecting" | "open" | "closed";

interface RunStoreState {
  events: TaskEvent[];
  connection: ConnectionState;
  connect: (taskId: string) => void;
  disconnect: () => void;
  reset: () => void;
}

let source: EventSource | null = null;

export const useRunStore = create<RunStoreState>((set, get) => ({
  events: [],
  connection: "idle",

  connect: (taskId) => {
    get().disconnect();
    set({ events: [], connection: "connecting" });

    source = openTaskStream(taskId, (event) => {
      set((state) => {
        if (state.events.some((existing) => existing.id === event.id)) {
          return state;
        }
        return {
          events: [...state.events, event].sort((a, b) => a.seq - b.seq),
        };
      });
    });

    source.onopen = () => set({ connection: "open" });
    source.onerror = () => set({ connection: "closed" });
  },

  disconnect: () => {
    source?.close();
    source = null;
    set({ connection: "idle" });
  },

  reset: () => set({ events: [], connection: "idle" }),
}));
