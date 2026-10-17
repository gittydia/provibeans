"use client";

import { useTheme, type Theme } from "@/lib/theme";

const nextTheme: Record<Theme, Theme> = {
  system: "light",
  light: "dark",
  dark: "system",
};

export function ThemeButton() {
  const { theme, setTheme } = useTheme();
  const next = nextTheme[theme];

  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={`Theme: ${theme}. Switch to ${next}`}
      title={`Theme: ${theme}`}
      onClick={() => setTheme(next)}
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {theme === "system" ? <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></> : null}
        {theme === "light" ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></> : null}
        {theme === "dark" ? <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" /> : null}
      </svg>
    </button>
  );
}
