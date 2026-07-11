import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        spiritual: {
          50: "var(--spiritual-50)",
          100: "var(--spiritual-100)",
          200: "var(--spiritual-200)",
          300: "var(--spiritual-300)",
          400: "var(--spiritual-400)",
          500: "var(--spiritual-500)",
          600: "var(--spiritual-600)",
          700: "var(--spiritual-700)",
          800: "var(--spiritual-800)",
          900: "var(--spiritual-900)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
      keyframes: {
        "roll-spin": {
          "0%": { transform: "rotate(0deg) scale(1)" },
          "100%": { transform: "rotate(720deg) scale(1)" },
        },
        "roll-bounce": {
          "0%": { 
            transform: "translateY(0) rotate(0deg) scale(1)",
            animationTimingFunction: "ease-out",
          },
          "25%": { 
            transform: "translateY(-15px) rotate(90deg) scale(1.05)",
            animationTimingFunction: "ease-in-out",
          },
          "50%": { 
            transform: "translateY(0) rotate(180deg) scale(1)",
            animationTimingFunction: "ease-in-out",
          },
          "75%": { 
            transform: "translateY(-10px) rotate(270deg) scale(1.02)",
            animationTimingFunction: "ease-in-out",
          },
          "100%": { 
            transform: "translateY(0) rotate(360deg) scale(1)",
            animationTimingFunction: "ease-in",
          },
        },
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "roll-spin": "roll-spin 4s ease-in-out infinite",
        "roll-bounce": "roll-bounce 3.3s ease-in-out infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
