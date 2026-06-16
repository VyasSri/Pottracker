import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      colors: {
        felt: {
          950: "#070304",
          900: "#0f0507",
          800: "#1c090c",
          700: "#2b0e12",
          600: "#3f1518",
          500: "#5c2025",
          400: "#8a3a40",
          300: "#b36470",
          200: "#d4a0a8",
          100: "#edddd8",
          50:  "#fdf5f3",
        },
        gold: {
          DEFAULT: "#e05050",
          50:  "#fef2f2",
          100: "#fee5e5",
          200: "#fcc8c8",
          300: "#f99999",
          400: "#e05050",
          500: "#c53030",
          600: "#a82020",
          700: "#8a1a1a",
        },
      },
      fontFamily: {
        display: ["var(--font-playfair)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 0 0 1px rgba(224,80,80,0.08), 0 4px 24px rgba(0,0,0,0.6)",
        "card-hover": "0 0 0 1px rgba(224,80,80,0.2), 0 8px 32px rgba(0,0,0,0.7)",
      },
    },
  },
  plugins: [],
};
export default config;
