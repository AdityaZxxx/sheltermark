"use client";

import type { ReactNode } from "react";

import { RadioGroupItem } from "~/components/ui/radio-group";

interface RadioCardProps {
  id: string;
  value: string;
  title: string;
  description: string;
  icon: ReactNode;
  badge?: ReactNode;
}

/**
 * Base UI renders `RadioGroupItem` as a button with a `data-checked`
 * attribute, not a native `:checked` input, so the selected treatment must
 * use `has-data-checked` (see components/ui/field.tsx) — `has-checked`
 * never matches. `group/card` lets the icon tile, a sibling of the radio,
 * read the same state.
 */
export function RadioCard({
  id,
  value,
  title,
  description,
  icon,
  badge,
}: RadioCardProps) {
  return (
    <label
      htmlFor={id}
      className="group/card flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:border-primary/40 has-data-checked:border-primary/60 has-data-checked:bg-primary/5"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-has-data-checked/card:bg-primary/10 group-has-data-checked/card:text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {title}
          {badge}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
      <RadioGroupItem value={value} id={id} className="shrink-0" />
    </label>
  );
}
