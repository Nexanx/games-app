import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(220 16% 18%)",
        input: "hsl(220 16% 18%)",
        ring: "hsl(42 75% 55%)",
        background: "hsl(222 28% 8%)",
        foreground: "hsl(210 30% 96%)",
        muted: {
          DEFAULT: "hsl(220 18% 14%)",
          foreground: "hsl(215 14% 68%)"
        },
        card: {
          DEFAULT: "hsl(220 22% 11%)",
          foreground: "hsl(210 30% 96%)"
        },
        primary: {
          DEFAULT: "hsl(159 72% 44%)",
          foreground: "hsl(165 88% 6%)"
        },
        accent: {
          DEFAULT: "hsl(42 68% 50%)",
          foreground: "hsl(32 50% 8%)"
        },
        destructive: {
          DEFAULT: "hsl(0 74% 58%)",
          foreground: "hsl(0 0% 100%)"
        }
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.04), 0 20px 60px rgba(0,0,0,0.35)"
      }
    }
  },
  plugins: [animate]
};

export default config;

