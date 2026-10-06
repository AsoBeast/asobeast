import {
  defaultShouldDehydrateQuery,
  isServer,
  MutationCache,
  QueryClient,
} from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { authMeKey } from "@/lib/queries";
import { retryDelayFor, shouldRetry } from "@/lib/query-retry";

const FORBIDDEN = 403;

function refusedByAccountState(error: Error): boolean {
  return error instanceof ApiError && error.envelope.statusCode === FORBIDDEN;
}

function makeQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    mutationCache: new MutationCache({
      onError: (error) => {
        if (refusedByAccountState(error)) {
          void client.invalidateQueries({ queryKey: authMeKey });
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        refetchOnWindowFocus: false,
        retry: isServer ? 0 : shouldRetry,
        retryDelay: retryDelayFor,
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
        shouldRedactErrors: () => false,
      },
    },
  });
  return client;
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
