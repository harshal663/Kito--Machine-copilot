/**
 * Centralized React Query key factories for type-safe cache management and invalidation.
 */

export const queryKeys = {
  machines: {
    all: ["machines"] as const,
    list: (params?: { limit?: number; offset?: number }) =>
      ["machines", "list", params ?? {}] as const,
    detail: (machineId: string) => ["machines", "detail", machineId] as const,
    trend: (machineId: string, hours?: number) =>
      ["machines", "trend", machineId, { hours: hours ?? 24 }] as const,
  },
  events: {
    all: ["events"] as const,
    list: (params?: { limit?: number; offset?: number }) =>
      ["events", "list", params ?? {}] as const,
    listByMachine: (machineId: string, params?: { status?: string; limit?: number }) =>
      ["events", "machine", machineId, params ?? {}] as const,
    detail: (eventId: string) => ["events", "detail", eventId] as const,
  },
  manuals: {
    byMachine: (machineId: string) => ["manuals", "machine", machineId] as const,
  },
  user: {
    me: () => ["user", "me"] as const,
  },
  factory: {
    mine: () => ["factory", "mine"] as const,
  },
};
