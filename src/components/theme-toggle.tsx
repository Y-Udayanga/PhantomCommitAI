"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

import { themeKey } from "@/lib/theme";
type Theme = "dark" | "light";

function subscribe(update: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key !== themeKey && event.key !== null) return;
    document.documentElement.dataset.theme =
      event.newValue === "light" ? "light" : "dark";
    update();
  };
  window.addEventListener("phantom-theme", update);
  window.addEventListener("storage", sync);
  return () => {
    window.removeEventListener("phantom-theme", update);
    window.removeEventListener("storage", sync);
  };
}
const snapshot = (): Theme =>
  document.documentElement.dataset.theme === "light" ? "light" : "dark";
const serverSnapshot = (): Theme => "dark";

export function useTheme() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

export function ThemeToggle() {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  function toggle() {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(themeKey, next);
    } catch {
      /* Theme still works when storage is unavailable. */
    }
    window.dispatchEvent(new Event("phantom-theme"));
  }
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      <span>{theme === "dark" ? "Light" : "Dark"} mode</span>
    </button>
  );
}
