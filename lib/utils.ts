import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const PASTEL_COLORS = [
  "bg-red-300",
  "bg-orange-300",
  "bg-amber-300",
  "bg-yellow-300",
  "bg-lime-300",
  "bg-green-300",
  "bg-emerald-300",
  "bg-teal-300",
  "bg-cyan-300",
  "bg-sky-300",
  "bg-blue-300",
  "bg-indigo-300",
  "bg-violet-300",
  "bg-purple-300",
  "bg-fuchsia-300",
  "bg-pink-300",
  "bg-rose-300",
];

export const PASTEL_HEX_COLORS = [
  "#fca5a5",
  "#fdba74",
  "#fcd34d",
  "#fde047",
  "#bef264",
  "#86efac",
  "#6ee7b7",
  "#5eead4",
  "#67e8f9",
  "#7dd3fc",
  "#93c5fd",
  "#a5b4fc",
  "#c4b5fd",
  "#d8b4fe",
  "#f0abfc",
  "#f9a8d4",
  "#fda4af",
];

export function getPastelColor(id: string) {
  if (id === "default" || !id) return "bg-muted";
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PASTEL_COLORS.length;
  return PASTEL_COLORS[index];
}

export function getPastelHexColor(id: string) {
  if (id === "default" || !id) return "#a3a3a3";
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PASTEL_HEX_COLORS.length;
  return PASTEL_HEX_COLORS[index];
}

export function safeDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url || "";
  }
}

export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
