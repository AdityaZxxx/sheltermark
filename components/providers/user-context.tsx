"use client";

import type { User } from "@supabase/supabase-js";

import { createContext, use } from "react";

const UserContext = createContext<User | null | undefined>(undefined);

interface UserProviderProps {
  user: User;
  children: React.ReactNode;
}

export function UserProvider({ user, children }: UserProviderProps) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

// Only rendered inside requireAuth-gated trees (dashboard, trash,
// workspace), so the identity is guaranteed by the time any consumer runs.
export function useUser(): User {
  // React 19+ ?new use() API replaces useContext for reading context values
  const user = use(UserContext);
  if (user == null) {
    throw new Error(
      "useUser must be used within an authenticated UserProvider tree",
    );
  }
  return user;
}
