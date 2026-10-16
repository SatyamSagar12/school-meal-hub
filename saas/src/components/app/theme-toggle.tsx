"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, SunMoon } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "Match device", icon: SunMoon },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

/**
 * A three-way segmented control rather than a toggle: "system" is a real
 * preference, and a two-state switch silently discards it.
 */
const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  // The server cannot know the resolved theme. useSyncExternalStore gives us
  // "are we hydrated yet" without a setState-in-effect cascade: it returns the
  // server snapshot during SSR and the client one after hydration.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="bg-muted/60 inline-flex items-center gap-0.5 rounded-lg p-0.5"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "focus-visible:ring-ring flex size-6 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
