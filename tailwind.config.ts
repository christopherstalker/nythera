import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const tokenColor = (token: string) => `oklch(var(--color-${token}) / <alpha-value>)`;

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
      screens: {
        xs: "390px",
        "3xl": "1920px"
      },
      maxWidth: {
        page: "var(--page-max-width)",
        chat: "var(--chat-max-width)",
        content: "var(--content-max-width)"
      },
      colors: {
        canvas: tokenColor("canvas"),
        surface: tokenColor("surface"),
        elevated: tokenColor("elevated"),
        content: {
          primary: tokenColor("text-primary"),
          secondary: tokenColor("text-secondary"),
          muted: tokenColor("text-muted"),
          disabled: tokenColor("text-disabled")
        },
        outline: {
          subtle: tokenColor("border-subtle"),
          DEFAULT: tokenColor("border-default"),
          strong: tokenColor("border-strong"),
          disabled: tokenColor("border-disabled")
        },
        brand: {
          DEFAULT: tokenColor("accent-primary"),
          strong: tokenColor("accent-strong"),
          secondary: tokenColor("accent-secondary"),
          soft: "oklch(var(--color-accent-primary) / .16)"
        },
        warning: tokenColor("warning"),
        danger: tokenColor("danger"),
        border: tokenColor("border-default"),
        input: tokenColor("surface"),
        ring: tokenColor("focus-ring"),
        background: tokenColor("canvas"),
        foreground: tokenColor("text-primary"),
        primary: {
          DEFAULT: tokenColor("accent-primary"),
          foreground: tokenColor("on-accent")
        },
        secondary: {
          DEFAULT: tokenColor("elevated"),
          foreground: tokenColor("text-primary")
        },
        destructive: {
          DEFAULT: tokenColor("danger"),
          foreground: tokenColor("on-danger")
        },
        muted: {
          DEFAULT: tokenColor("surface"),
          foreground: tokenColor("text-secondary")
        },
        accent: {
          DEFAULT: tokenColor("accent-primary"),
          foreground: tokenColor("on-accent")
        },
        card: {
          DEFAULT: tokenColor("surface"),
          foreground: tokenColor("text-primary")
        }
      },
      fontFamily: {
        sans: ['var(--font-space-grotesk, "Segoe UI")', "Roboto", "Arial", "sans-serif"]
      },
      fontSize: {
        display: ["var(--type-display)", { lineHeight: ".98", letterSpacing: "-.052em" }],
        "heading-1": ["var(--type-heading-1)", { lineHeight: "1.02", letterSpacing: "-.045em" }],
        "heading-2": ["var(--type-heading-2)", { lineHeight: "1.08", letterSpacing: "-.035em" }],
        "heading-3": ["var(--type-heading-3)", { lineHeight: "1.15", letterSpacing: "-.025em" }],
        body: ["var(--type-body)", { lineHeight: "1.6" }]
      },
      opacity: {
        40: ".4",
        56: ".56",
        60: ".6",
        72: ".72",
        80: ".8",
        88: ".88"
      },
      borderRadius: {
        compact: "var(--radius-compact)",
        control: "var(--radius-control)",
        card: "var(--radius-card)",
        surface: "var(--radius-surface)",
        panel: "var(--radius-panel)",
        full: "var(--radius-full)",
        lg: "var(--radius-card)",
        md: "var(--radius-control)",
        sm: "var(--radius-compact)"
      },
      backgroundImage: {
        "aurora-primary": "var(--gradient-aurora-primary)",
        "aurora-ambient": "var(--gradient-aurora-ambient)"
      },
      boxShadow: {
        raised: "var(--elevation-raised)",
        floating: "var(--elevation-floating)",
        glow: "var(--elevation-glow)",
        soft: "var(--elevation-raised)",
        "card-glow": "var(--elevation-floating)",
        "violet-hover": "var(--elevation-glow)",
        "violet-strong": "var(--elevation-glow)",
        "brand-hover": "var(--elevation-glow)",
        "brand-strong": "var(--elevation-glow)",
        inset: "var(--glass-highlight)"
      }
    }
  },
  plugins: [tailwindcssAnimate]
};

export default config;
