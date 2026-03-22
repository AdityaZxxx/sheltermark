"use client";

import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { makeQueryClient } from "~/lib/query-client";

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

interface QueryProviderProps {
  children: React.ReactNode;
}

function FocusRefetchHandler() {
  const queryClient = getQueryClient();
  const COOLDOWN_MS = 30_000;
  const lastRefetchRef = useRef(0);

  useEffect(() => {
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastRefetchRef.current >= COOLDOWN_MS) {
        lastRefetchRef.current = now;
        queryClient.invalidateQueries();
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [queryClient]);

  return null;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <FocusRefetchHandler />
      {children}
    </QueryClientProvider>
  );
}
