import { WarningIcon } from "@phosphor-icons/react";

import type { BrokenStatus } from "~/lib/link-health/types";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn, resolveBrokenState } from "~/lib/utils";

interface BrokenLinkWarningProps {
  brokenStatus: BrokenStatus | string | null | undefined;
  httpStatus?: number | null;
  autoCheckBroken?: boolean;
}

/**
 * Renders a single warning icon for a bookmark whose link-health
 * state is rendered via resolveBrokenState. Centralised so all
 * three view variants (list/card/comfort) show identical severity,
 * message, and icon. Hidden when broken-link checking is disabled
 * or when the bookmark is in a non-warning state.
 */
export function BrokenLinkWarning({
  brokenStatus,
  httpStatus,
  autoCheckBroken,
}: BrokenLinkWarningProps) {
  if (!autoCheckBroken) return null;

  const state = resolveBrokenState({
    status: brokenStatus,
    httpStatus,
  });

  if (!state.showWarning) return null;

  const isWarning = state.severity === "warning";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="cursor-help shrink-0" title={state.message}>
            {isWarning ? (
              <WarningIcon className="w-3 h-3 text-red-500" weight="fill" />
            ) : (
              <WarningIcon
                className={cn(
                  "w-3 h-3",
                  state.severity === "subtle"
                    ? "text-amber-500/80"
                    : "text-muted-foreground",
                )}
                weight="fill"
              />
            )}
          </span>
        }
      />
      <TooltipContent>
        <span>{state.message}</span>
      </TooltipContent>
    </Tooltip>
  );
}
