import type React from "react";

export function PreviewStage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-2 md:p-3">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border/60 bg-muted/20">
        {children}
      </div>
    </div>
  );
}
