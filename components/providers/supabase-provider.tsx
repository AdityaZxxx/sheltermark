"use client";

import type { createBrowserClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, use, useEffect, useRef, useState } from "react";

import { createClient } from "~/lib/supabase/client";

interface SupabaseContextValue {
  supabase: ReturnType<typeof createBrowserClient>;
  user: User | null;
  isLoading: boolean;
}

const SupabaseContext = createContext<SupabaseContextValue | null>(null);

export function useSupabase() {
  const context = use(SupabaseContext);
  if (!context) {
    throw new Error("useSupabase must be used within SupabaseProvider");
  }
  return context;
}

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: supabaseUser } }) => {
      // Record the identity before onAuthStateChange fires its initial
      // event for the same session: the ref is still null there, so the
      // "identity changed" branch would wipe every in-flight query
      // (queryClient.clear()) right as the app starts fetching, leaving
      // mounted observers pointing at removed cache rows (stuck loading).
      lastUserIdRef.current = supabaseUser?.id ?? null;
      setUser(supabaseUser);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      if (nextUserId !== lastUserIdRef.current) {
        // Identity changed (login, logout, expiry): drop every cached query
        // so the previous account's rows are never rendered for this one.
        queryClient.clear();
        lastUserIdRef.current = nextUserId;
      }
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase, queryClient]);

  return (
    <SupabaseContext.Provider value={{ supabase, user, isLoading }}>
      {children}
    </SupabaseContext.Provider>
  );
}
