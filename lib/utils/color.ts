const PASTEL_COLORS = [
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
  "#fecaca",
  "#fed7aa",
  "#fef08a",
  "#d9f99d",
  "#a7f3d0",
  "#a5f3fc",
  "#bae6fd",
  "#c7d2fe",
  "#ddd6fe",
  "#e9d5ff",
  "#fbcfe8",
  "#fecdd3",
  "#ffe4e6",
  "#ffedd5",
  "#fef3c7",
  "#ecfccb",
  "#dcfce7",
  "#ccfbf1",
  "#cffafe",
  "#e0f2fe",
  "#e0e7ff",
  "#ede9fe",
  "#f3e8ff",
  "#fae8ff",
  "#fce7f3",
  "#ffe4e6",
  "#f0fdf4",
  "#ecfeff",
  "#eff6ff",
  "#f5f3ff",
  "#faf5ff",
  "#fdf4ff",
  "#fdf2f8",
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
