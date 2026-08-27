/**
 * ThemeContext — ZyntraFocus is dark-only.
 * This context always applies the 'dark' class to <html>.
 * The user-facing theme toggle has been removed.
 * Context is kept for structural consistency and potential future use.
 */
import React, { createContext, useContext, useEffect } from 'react'

interface ThemeContextValue {
  resolvedTheme: 'dark'
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always dark — apply once on mount
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light')
    root.classList.add('dark')
  }, [])

  return (
    <ThemeContext.Provider value={{ resolvedTheme: 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
