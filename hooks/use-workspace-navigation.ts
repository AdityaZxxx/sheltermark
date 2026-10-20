"use client";

import { usePathname, useRouter } from "next/navigation";
import { createParser, useQueryState } from "nuqs";
import { useCallback } from "react";

import { uuidSchema } from "~/lib/schemas/common";

const WORKSPACE_ROUTE = "/dashboard";

const workspaceIdParamParser = createParser({
  parse: (value) => (uuidSchema.safeParse(value).success ? value : null),
  serialize: (value) => value,
}).withOptions({ shallow: true });

export function useWorkspaceIdParam() {
  return useQueryState("workspaceId", workspaceIdParamParser);
}

export function useWorkspaceNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [workspaceIdParam, setWorkspaceIdParam] = useWorkspaceIdParam();

  // The workspaceId param is only interpreted by the dashboard. On any other
  // route writing it would leave the user where they are, so the selection has
  // to become a navigation to the dashboard instead.
  const isWorkspaceRoute = pathname === WORKSPACE_ROUTE;

  const goToWorkspace = useCallback(
    (workspaceId: string | null) => {
      if (isWorkspaceRoute) {
        setWorkspaceIdParam(workspaceId);
        return;
      }
      router.push(
        workspaceId
          ? `${WORKSPACE_ROUTE}?workspaceId=${workspaceId}`
          : WORKSPACE_ROUTE,
      );
    },
    [isWorkspaceRoute, router, setWorkspaceIdParam],
  );

  return { isWorkspaceRoute, workspaceIdParam, goToWorkspace };
}
