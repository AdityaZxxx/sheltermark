"use client";

import type { createBrowserClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "~/utils/supabase/client";

interface SupabaseContextValue {
  supabase: ReturnType<typeof createBrowserClient>;
  user: User | null;
  isLoading: boolean;
}

const SupabaseContext = createContext<SupabaseContextValue | null>(null);

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error("useSupabase must be used within SupabaseProvider");
  }
  return context;
}

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return (
    <SupabaseContext.Provider value={{ supabase, user, isLoading }}>
      {children}
    </SupabaseContext.Provider>
  );
}
