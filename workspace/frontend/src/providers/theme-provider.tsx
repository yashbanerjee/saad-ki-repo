"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Admin panel defaults to light and stays light until the user
 * explicitly picks dark. System preference is ignored.
 * storageKey bumped so older dark defaults don't stick.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="taskflow-theme-v2"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
