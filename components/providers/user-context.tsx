"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, use } from "react";

const UserContext = createContext<User | null | undefined>(undefined);

interface UserProviderProps {
  user: User | null;
  children: React.ReactNode;
}

export function UserProvider({ user, children }: UserProviderProps) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser() {
  // React 19+ ?new use() API replaces useContext for reading context values
  return use(UserContext);
}
