import {
  type MutationKey,
  type QueryClient,
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import type { ActionResult } from "~/lib/action-result";

import { logger } from "~/lib/utils/logger";

export function optimisticRemove<T extends { id: string }>(
  oldData: T[] | undefined,
  id: string | string[],
  getKey: (item: T) => string = (item) => item.id,
): T[] {
  const prev = oldData ?? [];
  const idsToRemove = new Set(Array.isArray(id) ? id : [id]);
  return prev.filter((item) => !idsToRemove.has(getKey(item)));
}

export function optimisticUpdate<T extends { id: string }>(
  oldData: T[] | undefined,
  id: string,
  updater: (item: T) => T,
  getKey: (item: T) => string = (item) => item.id,
): T[] {
  const prev = oldData ?? [];
  return prev.map((item) => (getKey(item) === id ? updater(item) : item));
}

export function optimisticAppend<T>(oldData: T[] | undefined, item: T): T[] {
  return [...(oldData ?? []), item];
}

export function optimisticPrepend<T>(oldData: T[] | undefined, item: T): T[] {
  return [item, ...(oldData ?? [])];
}

/**
 * A secondary cache write applied during optimistic update.
 *
 * `apply` receives the live QueryClient so each update reads and writes
 * its own cache entry with the owner's concrete data type instead of a
 * type-erased updater.
 */
export interface AdditionalOptimisticUpdate {
  key: QueryKey;
  apply: (client: QueryClient) => void;
}

/**
 * Wrap a typed cache update as an AdditionalOptimisticUpdate.
 * The updater's TData is the owner contract of `key`'s cache entry.
 */
export function typedUpdate<TData>(
  key: QueryKey,
  updater: (oldData: TData | undefined) => TData,
): AdditionalOptimisticUpdate {
  return {
    key,
    apply: (client) => {
      client.setQueryData(key, updater(client.getQueryData<TData>(key)));
    },
  };
}

interface OptimisticMutationOptions<TVariables, TData, TQueryData> {
  mutationFn: (variables: TVariables) => Promise<ActionResult<TData>>;
  mutationKey?: MutationKey;
  queryKey: QueryKey;
  dependentQueryKeys?: readonly QueryKey[];
  additionalOptimisticUpdates?: (
    variables: TVariables,
    optimisticPrimaryData: TQueryData,
  ) => AdditionalOptimisticUpdate[];
  successMessage?: string | null;
  successMessageOnMutate?: boolean;
  errorMessage?: string;
  prepareOptimisticData: (
    oldData: TQueryData | undefined,
    variables: TVariables,
  ) => TQueryData;
  onSuccess?: (result: ActionResult<TData>) => void;
}

interface MutationContext {
  rollback: () => void;
  additionalKeys: readonly QueryKey[];
  successToastId?: string | number;
}

export function useOptimisticMutation<TVariables, TData, TQueryData>(
  options: OptimisticMutationOptions<TVariables, TData, TQueryData>,
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
      const previousData = queryClient.getQueryData<TQueryData>(queryKey);

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

      const restoreSteps: Array<() => void> = [];
      if (previousData !== undefined) {
        restoreSteps.push(() => {
          queryClient.setQueryData(queryKey, previousData);
        });
      }
      for (const update of additionalUpdates) {
        const prev = queryClient.getQueryData(update.key);
        if (prev !== undefined) {
          restoreSteps.push(() => {
            queryClient.setQueryData(update.key, prev);
          });
          update.apply(queryClient);
        }
      }

      let successToastId: string | number | undefined;
      if (successMessageOnMutate && successMessage !== null) {
        successToastId = toast.success(successMessage);
      }

      return {
        rollback: () => {
          for (const step of restoreSteps) step();
        },
        additionalKeys: additionalUpdates.map((update) => update.key),
        successToastId,
      };
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
      context?.rollback();
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
      if (context?.additionalKeys) {
        for (const key of context.additionalKeys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }
      for (const depKey of dependentQueryKeys) {
        queryClient.invalidateQueries({ queryKey: depKey });
      }
    },
  });
}
