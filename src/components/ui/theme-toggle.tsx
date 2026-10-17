"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n/provider"

export function ThemeToggle() {
  // The resolved theme (what is on screen), not the stored choice: while that is still "system" the first click must
  // leave the theme the page is showing, not set the one it already has.
  const { resolvedTheme, setTheme } = useTheme()
  const { t } = useI18n()

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="rounded-full bg-background/50 glassmorphism border-border"
    >
      <Sun aria-hidden className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon aria-hidden className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">{t("theme.toggle")}</span>
    </Button>
  )
}
