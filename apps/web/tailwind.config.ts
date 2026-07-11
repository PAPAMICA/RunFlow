import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        "card-hover": "var(--card-hover)",
        "surface-2": "var(--surface-2)",
        elevated: "var(--elevated)",
        border: "var(--border)",
        "border-subtle": "var(--border-subtle)",
        "border-strong": "var(--border-strong)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        accent: "var(--accent)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        success: "var(--success)",
        warning: "var(--warning)",
        destructive: "var(--destructive)",
        info: "var(--info)",
        ring: "var(--ring)",
        sidebar: "var(--sidebar)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        lg: "0.625rem",
        xl: "0.875rem",
        "2xl": "1.1rem",
        "3xl": "1.5rem",
      },
      animation: {
        "fade-in": "fadeIn 0.25s ease-out",
        "slide-up": "slideUp 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
        "scale-in": "scaleIn 0.15s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
