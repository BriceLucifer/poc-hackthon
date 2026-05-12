/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
        display: [
          "SF Pro Display",
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
        ink: {
          900: "#0b0c0f",
          800: "#16181d",
          700: "#1f2228",
          500: "#6e7079",
          400: "#9aa0a8",
          300: "#c5c8cf",
          200: "#e6e7ea",
          100: "#f3f4f6",
          50: "#fafafb",
        },
        flag: {
          green: "#34c759",
          amber: "#ff9f0a",
          red: "#ff3b30",
          blue: "#0a84ff",
        },
      },
      boxShadow: {
        glass:
          "0 1px 0 rgba(255,255,255,0.6) inset, 0 20px 50px -20px rgba(15,17,21,0.25), 0 8px 24px -12px rgba(15,17,21,0.15)",
        "glass-dark":
          "0 1px 0 rgba(255,255,255,0.05) inset, 0 30px 60px -25px rgba(0,0,0,0.65)",
        soft: "0 1px 2px rgba(15,17,21,0.04), 0 8px 24px -8px rgba(15,17,21,0.08)",
      },
      backdropBlur: {
        xs: "2px",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "rise-in": "riseIn 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
        shimmer: "shimmer 2.5s linear infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        riseIn: {
          "0%": { opacity: 0, transform: "translateY(10px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
