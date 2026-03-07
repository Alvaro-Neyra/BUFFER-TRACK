import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#137fec",
        "background-light": "#f4f7f6",
        "background-dark": "#101922",
        "neutral-100": "#f1f5f9",
        "neutral-200": "#e2e8f0",
        "neutral-300": "#cbd5e1",
        "neutral-400": "#94a3b8",
        "neutral-500": "#64748b",
        "neutral-600": "#475569",
        "neutral-700": "#334155",
        "neutral-800": "#1e293b",
        "neutral-900": "#0f172a",
        "warning": "#eab308",
        "success": "#22c55e",
        "danger": "#ef4444",
        "hvac": "#3b82f6",
        "plumbing": "#ef4444",
        "electrical": "#eab308",
      },
      fontFamily: {
        "display": ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        "DEFAULT": "0.375rem",
        "md": "0.375rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
