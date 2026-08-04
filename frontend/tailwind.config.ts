import type { Config } from "tailwindcss";

// Brand + full state palette lifted directly from mydesign/Alaiy OS Dashboard.dc.html
// (the approved design). Literal hex, not HSL-wrapped: this app is light-mode only,
// so there's no runtime theme to switch and no need for the indirection.
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
    },
    extend: {
      fontFamily: {
        sans: ["Geist", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },

        // --- Design-literal palette (see docs/DESIGN_TOKENS.md) ---
        navy: { DEFAULT: "#003254", hover: "#013F66" },
        blue: "#91D1F2",
        paper: "#F7F4EF",
        ink: "#1A1A2E",

        surface: {
          faint: "#FBF9F6", // table header bg, row hover
          subtle: "#F9F7F4", // kbd chip bg
          dashed: "#FDFCFA", // dashed wireframe panel bg
          hoverBlue: "#F1F8FD", // suggestion chip hover
        },
        line: {
          faint: "#F1EDE6", // hairline dividers
          subtle: "#EDE8E0", // card borders
          DEFAULT: "#E7E2D9", // input/button borders (default)
          strong: "#E0DAD0", // secondary button borders
          hover: "#CFC8BC",
          dashed: "#DCD5C9",
        },
        ash: {
          DEFAULT: "#8E8E9E", // uppercase labels, muted meta
          2: "#9C9CAC", // icons, secondary meta
          3: "#A8A296", // wireframe placeholder text
        },
        slate: {
          DEFAULT: "#6B6B7B", // body secondary text
          2: "#3E4759", // table secondary cell text
          3: "#5C6472", // grey pill text
        },
        tag: {
          DEFAULT: "#003254",
          bg: "#EDF6FC",
          border: "#D5EAF7",
        },

        // Status pill pairs: <status>-fg / <status>-bg
        success: { fg: "#15803D", bg: "#EAF6EE" },
        warning: { fg: "#96601A", bg: "#FDF6E9" },
        info: { fg: "#1F5E86", bg: "#EDF6FC" },
        danger: { fg: "#B4232A", bg: "#FDF2F2", hover: "#9C1B22" },
        neutralPill: { fg: "#5C6472", bg: "#F3F3F5" },

        chart: {
          draft: "#C9C2B6",
          toBill: "#4F86A8",
          onHold: "#D9A94C",
          track: "#F3F0EA",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "om-fade": { from: { opacity: "0" }, to: { opacity: "1" } },
        "om-rise": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        "om-slide-in": { from: { transform: "translateX(24px)", opacity: "0" }, to: { transform: "none", opacity: "1" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "om-fade": "om-fade .14s ease-out both",
        "om-rise": "om-rise .18s ease-out both",
        "om-slide-in": "om-slide-in .22s cubic-bezier(.32,.72,0,1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
