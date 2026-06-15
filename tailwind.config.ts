import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: false,
      padding: {
        DEFAULT: "1rem",
        md: "1.5rem",
        xl: "2rem"
      },
      screens: {
        sm: "100%",
        md: "100%",
        lg: "100%",
        xl: "100%",
        "2xl": "100%"
      }
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      boxShadow: {
        soft: "0 22px 70px rgba(0, 0, 0, 0.38)",
        "card-glow": "0 18px 60px rgba(7, 5, 14, 0.42)",
        "violet-hover": "0 18px 55px rgba(255, 122, 24, 0.16)",
        "violet-strong": "0 0 44px rgba(255, 122, 24, 0.26)",
        "brand-hover": "0 18px 55px rgba(255, 122, 24, 0.16)",
        "brand-strong": "0 0 44px rgba(255, 122, 24, 0.26)",
        inset: "inset 0 1px 0 rgba(255, 255, 255, 0.05)"
      }
    }
  },
  plugins: [tailwindcssAnimate]
};

export default config;
