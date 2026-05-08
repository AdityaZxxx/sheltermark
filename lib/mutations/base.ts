import {
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { ActionResult } from "~/lib/action-result";
import { logger } from "~/lib/logger";

// Generic optimistic mutation options
interface OptimisticMutationOptions<TVariables, TData> {
  mutationFn: (variables: TVariables) => Promise<ActionResult<TData>>;
  queryKey: QueryKey;
  dependentQueryKeys?: readonly QueryKey[];
  successMessage?: string | null;
  errorMessage?: string;
  /** Optional: transform the current data with the incoming variables to create optimistic data */
  prepareOptimisticData?: (oldData: unknown, variables: TVariables) => unknown;
  /** Optional: provide a function to access the current data (not required for mutation) */
  getCurrentData?: () => unknown;
}

/**
 * createOptimisticMutation
 * A fully-typed generic factory for optimistic mutations.
 * - Handles optimistic update in onMutate
 * - Reverts on error using context
 * - Shows toasts on success/error
 * - Invalidates queries on settled
 */
export function createOptimisticMutation<TVariables, TData = unknown>(
  options: OptimisticMutationOptions<TVariables, TData>,
) {
  const {
    mutationFn,
    queryKey,
    dependentQueryKeys = [],
    successMessage = "Success",
    errorMessage = "Operation failed",
    prepareOptimisticData,
  } = options;

  const queryClient = useQueryClient();

  // Return a mutation object created with TanStack Query
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
