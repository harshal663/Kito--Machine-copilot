import { QueryClient } from "@tanstack/react-query";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000, // 10s default cache fresh window
        gcTime: 5 * 60_000, // 5m cache retention
        retry: (failureCount, error) => {
          // Do not retry 4xx client errors
          if (
            error &&
            typeof error === "object" &&
            "status" in error &&
            typeof error.status === "number" &&
            error.status >= 400 &&
            error.status < 500
          ) {
            return false;
          }
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

let clientQueryClientSingleton: QueryClient | undefined = undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    // Server: always create fresh QueryClient
    return createQueryClient();
  }
  // Browser: keep singleton
  if (!clientQueryClientSingleton) {
    clientQueryClientSingleton = createQueryClient();
  }
  return clientQueryClientSingleton;
}
