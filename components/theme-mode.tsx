"use client";

import { LaptopIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";

type Theme = "light" | "dark" | "system";

const THEMES: { value: Theme; icon: React.ElementType; label: string }[] = [
  { value: "light", icon: SunIcon, label: "Light" },
  { value: "dark", icon: MoonIcon, label: "Dark" },
  { value: "system", icon: LaptopIcon, label: "System" },
];

type Size = "sm" | "md" | "lg";

const SIZE = {
  sm: { icon: "h-3 w-3", padding: "p-1.5" },
  md: { icon: "h-4 w-4", padding: "p-2" },
  lg: { icon: "h-5 w-5", padding: "p-2.5" },
} satisfies Record<Size, { icon: string; padding: string }>;

interface ThemeModeProps {
  variant?: "tabs" | "rounding";
  size?: Size;
  className?: string;
}

export function ThemeMode({
  variant = "tabs",
  size = "md",
  className,
}: ThemeModeProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const { icon: iconSize, padding } = SIZE[size];

  if (variant === "rounding") {
    return (
      <div
        className={cn(
          "inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-800 p-1 gap-0.5",
          className,
        )}
      >
        {THEMES.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            type="button"
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "relative flex items-center justify-center rounded-full transition-all duration-200",
              padding,
              "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100",
              theme === value && [
                "bg-white dark:bg-neutral-700",
                "text-neutral-900 dark:text-neutral-100",
                "shadow-sm shadow-black/10 dark:shadow-black/30",
              ],
            )}
          >
            <Icon
              className={cn(
                iconSize,
                "transition-transform duration-200",
                theme === value && "scale-110",
              )}
            />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("p-1.5", className)}>
      <Tabs value={theme} onValueChange={(v) => setTheme(v)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
          {THEMES.map(({ value, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className={cn(
                "rounded-md transition-all duration-200",
                "text-neutral-500 dark:text-neutral-400",
                "hover:text-neutral-900 dark:hover:text-neutral-100",
                "data-active:bg-white! dark:data-active:bg-neutral-700!",
                "data-active:text-neutral-900! dark:data-active:text-neutral-100!",
                "data-active:shadow-sm! data-active:shadow-black/10! dark:data-active:shadow-black/30!",
              )}
            >
              <Icon
                className={cn(
                  iconSize,
                  "transition-transform duration-200",
                  theme === value && "scale-110",
                )}
              />
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
