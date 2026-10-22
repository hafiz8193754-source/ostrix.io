import type { Config } from "tailwindcss";

// Every color resolves to a CSS custom property defined in app/globals.css —
// components must reference these tokens, never a hardcoded hex value.
const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "var(--bg-base)",
          surface: "var(--bg-surface)",
          elevated: "var(--bg-elevated)",
          overlay: "var(--bg-overlay)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          glow: "var(--accent-glow)",
          fg: "var(--accent-fg)",
          soft: "var(--accent-soft)",
        },
        warm: {
          DEFAULT: "var(--warm)",
          strong: "var(--warm-strong)",
          soft: "var(--warm-soft)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        border: {
          DEFAULT: "var(--border)",
          subtle: "var(--border-subtle)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "Consolas", "monospace"],
      },
      borderRadius: {
        xl: "16px",
        "2xl": "20px",
        lg: "12px",
        md: "10px",
        sm: "8px",
      },
      boxShadow: {
        glow: "0 0 24px var(--accent-glow)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "1" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 0px var(--accent-glow)" },
          "50%": { boxShadow: "0 0 20px var(--accent-glow)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.25s ease-out",
        "pulse-dot": "pulse-dot 1.4s ease-in-out infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        blink: "blink 0.8s step-end infinite",
      },
    },
  },
  plugins: [],
};

export default config;
