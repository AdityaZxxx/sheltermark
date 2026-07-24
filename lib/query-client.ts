import { QueryClient } from "@tanstack/react-query";

export const makeQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
      },
    },
  });
};
