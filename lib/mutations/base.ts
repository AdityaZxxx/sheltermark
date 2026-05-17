import {
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { ActionResult } from "~/lib/action-result";
import { logger } from "~/lib/logger";

interface OptimisticMutationOptions<TVariables, TData> {
  mutationFn: (variables: TVariables) => Promise<ActionResult<TData>>;
  queryKey: QueryKey;
  dependentQueryKeys?: readonly QueryKey[];
  successMessage?: string | null;
  errorMessage?: string;
  prepareOptimisticData?: (oldData: unknown, variables: TVariables) => unknown;
  getCurrentData?: () => unknown;
}

export function useOptimisticMutation<TVariables, TData = unknown>(
  options: OptimisticMutationOptions<TVariables, TData>,
) {
  const queryClient = useQueryClient();
  const {
    mutationFn,
    queryKey,
    dependentQueryKeys = [],
    successMessage = "Success",
    errorMessage = "Operation failed",
    prepareOptimisticData,
  } = options;

  return useMutation<
    ActionResult<TData>,
    Error,
    TVariables,
    { previousData?: unknown }
  >({
    mutationFn,
    onMutate: async (variables: TVariables) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData(queryKey);

      if (prepareOptimisticData && previousData !== undefined) {
        const optimistic = prepareOptimisticData(previousData, variables);
        queryClient.setQueryData(queryKey, optimistic);
      }

      return { previousData };
    },
    onError: (
      error: Error,
      variables: TVariables,
      context: { previousData?: unknown } | undefined,
    ) => {
      logger.error("Mutation failed", {
        error,
        variables,
        mutationKey: queryKey,
      });
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      toast.error(errorMessage);
    },
    onSuccess: (result: ActionResult<TData>) => {
      if (result?.success) {
        if (successMessage !== null) {
          toast.success(successMessage);
        }
      } else {
        toast.error(result?.error ?? errorMessage);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      for (const depKey of dependentQueryKeys) {
        queryClient.invalidateQueries({ queryKey: depKey });
      }
    },
  });
}
