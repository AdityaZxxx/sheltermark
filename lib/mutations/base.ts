import {
  type MutationKey,
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { ActionResult } from "~/lib/action-result";
import { logger } from "~/lib/logger";

function defaultKey<T>(item: T): string {
  return (item as { id: string }).id as string;
}

export function optimisticRemove<T>(
  oldData: unknown,
  id: string | string[],
  getKey: (item: T) => string = defaultKey,
): T[] {
  const prev = (oldData as T[]) ?? [];
  const idsToRemove = new Set(Array.isArray(id) ? id : [id]);
  return prev.filter((item) => !idsToRemove.has(getKey(item)));
}

export function optimisticUpdate<T>(
  oldData: unknown,
  id: string,
  updater: (item: T) => T,
  getKey: (item: T) => string = defaultKey,
): T[] {
  const prev = (oldData as T[]) ?? [];
  return prev.map((item) => (getKey(item) === id ? updater(item) : item));
}

export function optimisticAppend<T>(oldData: unknown, item: T): T[] {
  const prev = (oldData as T[]) ?? [];
  return [...prev, item];
}

export function optimisticPrepend<T>(oldData: unknown, item: T): T[] {
  const prev = (oldData as T[]) ?? [];
  return [item, ...prev];
}

interface AdditionalOptimisticUpdate {
  key: QueryKey;
  updater: (oldData: unknown) => unknown;
}

interface OptimisticMutationOptions<TVariables, TData> {
  mutationFn: (variables: TVariables) => Promise<ActionResult<TData>>;
  mutationKey?: MutationKey;
  queryKey: QueryKey;
  dependentQueryKeys?: readonly QueryKey[];
  additionalOptimisticUpdates?: (
    variables: TVariables,
    optimisticPrimaryData: unknown,
  ) => AdditionalOptimisticUpdate[];
  successMessage?: string | null;
  successMessageOnMutate?: boolean;
  errorMessage?: string;
  prepareOptimisticData: (oldData: unknown, variables: TVariables) => unknown;
  onSuccess?: (result: ActionResult<TData>) => void;
}

interface AdditionalPreviousData {
  key: QueryKey;
  data: unknown;
}

interface MutationContext {
  previousData?: unknown;
  additionalPreviousData: AdditionalPreviousData[];
  successToastId?: string | number;
}

export function useOptimisticMutation<TVariables, TData = unknown>(
  options: OptimisticMutationOptions<TVariables, TData>,
) {
  const queryClient = useQueryClient();
  const {
    mutationFn,
    mutationKey,
    queryKey,
    dependentQueryKeys = [],
    additionalOptimisticUpdates,
    successMessage = "Success",
    successMessageOnMutate = false,
    errorMessage = "Operation failed",
    prepareOptimisticData,
    onSuccess: onSuccessOverride,
  } = options;

  return useMutation<ActionResult<TData>, Error, TVariables, MutationContext>({
    mutationFn,
    mutationKey,
    onMutate: async (variables: TVariables) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData(queryKey);

      const optimisticPrimaryData = prepareOptimisticData(
        previousData,
        variables,
      );
      queryClient.setQueryData(queryKey, optimisticPrimaryData);

      const additionalUpdates =
        additionalOptimisticUpdates?.(variables, optimisticPrimaryData) ?? [];

      await Promise.all(
        additionalUpdates.map((update) =>
          queryClient.cancelQueries({ queryKey: update.key }),
        ),
      );

      const additionalPreviousData: AdditionalPreviousData[] = [];
      for (const update of additionalUpdates) {
        const prev = queryClient.getQueryData(update.key);
        additionalPreviousData.push({ key: update.key, data: prev });
        if (prev !== undefined) {
          queryClient.setQueryData(update.key, update.updater(prev));
        }
      }

      let successToastId: string | number | undefined;
      if (successMessageOnMutate && successMessage !== null) {
        successToastId = toast.success(successMessage);
      }

      return { previousData, additionalPreviousData, successToastId };
    },
    onError: (
      error: Error,
      variables: TVariables,
      context: MutationContext | undefined,
    ) => {
      logger.error("Mutation failed", {
        error,
        variables,
        mutationKey: queryKey,
      });
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      if (context?.additionalPreviousData) {
        for (const entry of context.additionalPreviousData) {
          if (entry.data !== undefined) {
            queryClient.setQueryData(entry.key, entry.data);
          }
        }
      }
      if (context?.successToastId !== undefined) {
        toast.dismiss(context.successToastId);
      }
      toast.error(errorMessage);
    },
    onSuccess: (result: ActionResult<TData>) => {
      if (onSuccessOverride) {
        onSuccessOverride(result);
        return;
      }
      if (result?.success) {
        if (successMessage !== null && !successMessageOnMutate) {
          toast.success(successMessage);
        }
      } else {
        toast.error(result?.error ?? errorMessage);
      }
    },
    onSettled: (
      _data: ActionResult<TData> | undefined,
      _error: Error | null,
      _variables: TVariables,
      context: MutationContext | undefined,
    ) => {
      queryClient.invalidateQueries({ queryKey });
      if (context?.additionalPreviousData) {
        for (const entry of context.additionalPreviousData) {
          queryClient.invalidateQueries({ queryKey: entry.key });
        }
      }
      for (const depKey of dependentQueryKeys) {
        queryClient.invalidateQueries({ queryKey: depKey });
      }
    },
  });
}
