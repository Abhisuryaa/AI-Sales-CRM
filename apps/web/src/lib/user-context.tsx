"use client";

import { createContext, useContext } from "react";

import type { Role } from "@/lib/types";

export interface AppUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: Role;
}

export const UserContext = createContext<AppUser | null>(null);

export function useUser(): AppUser {
  const user = useContext(UserContext);
  if (!user) throw new Error("useUser must be used within UserContext");
  return user;
}

export function canWrite(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "SALES_REP";
}

export function canApprove(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

export function isAdmin(role: Role): boolean {
  return role === "ADMIN";
}
