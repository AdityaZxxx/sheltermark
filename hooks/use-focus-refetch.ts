"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export function useFocusRefetch(queryKeys: (string | unknown[])[]) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const handleFocus = () => {
      queryKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key as never });
      });
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [queryClient, queryKeys]);
}
