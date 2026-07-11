import { QueryClient, type QueryFunction } from "@tanstack/react-query";
import { requestJson } from "./api";

const defaultQueryFn: QueryFunction<unknown> = ({ queryKey }) =>
  requestJson("GET", queryKey.join("/"));

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
