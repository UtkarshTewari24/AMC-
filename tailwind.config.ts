import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#080d1a",
          900: "#0b1226",
          850: "#0f1830",
          800: "#131e3d",
          700: "#1b2a54",
          600: "#25376b",
        },
        ink: {
          DEFAULT: "#e4e9f7",
          dim: "#9aa5c4",
          faint: "#5d6a8f",
        },
        accent: {
          DEFAULT: "#6366f1",
          bright: "#818cf8",
          dim: "#4f46e5",
        },
        good: "#34d399",
        bad: "#f87171",
        warn: "#fbbf24",
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "JetBrains Mono",
          "monospace",
        ],
      },
      backgroundImage: {
        "graph-paper":
          "linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "24px 24px",
      },
    },
  },
  plugins: [],
};
export default config;
