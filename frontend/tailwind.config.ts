import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "#ff5733",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "#ff5733",
          foreground: "#ffffff",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "#ff5733",
        status: {
          healthy: "var(--status-healthy)",
          "healthy-text": "var(--status-healthy-text)",
          "healthy-bg": "var(--status-healthy-bg)",
          alert: "var(--status-alert)",
          "alert-text": "var(--status-alert-text)",
          "alert-bg": "var(--status-alert-bg)",
          learning: "var(--status-learning)",
          "learning-text": "var(--status-learning-text)",
          "learning-bg": "var(--status-learning-bg)",
          offline: "var(--status-offline)",
          "offline-text": "var(--status-offline-text)",
          "offline-bg": "var(--status-offline-bg)",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "var(--font-devanagari)", "system-ui", "-apple-system", "sans-serif"],
        serif: ["var(--font-playfair)", "Georgia", "Times New Roman", "serif"],
        display: ["var(--font-playfair)", "Georgia", "Times New Roman", "serif"],
      },
      borderRadius: {
        DEFAULT: "0.75rem",
        sm: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.25rem",
      },
      minHeight: {
        touch: "var(--touch-min, 44px)",
      },
      minWidth: {
        touch: "var(--touch-min, 44px)",
      },
    },
  },
  plugins: [],
};

export default config;
