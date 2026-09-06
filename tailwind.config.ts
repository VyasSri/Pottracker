import type { Config } from "tailwindcss";

/**
 * Design tokens — clean "ledger" light theme.
 *
 * The app was originally a dark maroon casino theme. The `felt` and `gold`
 * scales are reused verbatim across every component, so the palette is
 * remapped here by *role* to flip the whole app to a light, neutral surface
 * with a single emerald accent. Higher `felt` numbers = darker text roles,
 * lower numbers = lighter surface roles (inverted from a normal dark ramp).
 */
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm-neutral surfaces + text (stone-derived), role-preserving.
        felt: {
          950: "#eceae7", // deepest inset (inputs, wells)
          900: "#f6f5f3", // page background
          800: "#ffffff", // card / raised surface
          700: "#eeecea", // hover surface / skeleton / faint divider
          600: "#e4e2de", // hairline border
          500: "#8c847c", // faint meta / placeholder / icon
          400: "#78716c", // muted text
          300: "#57534e", // secondary text / nav links
          200: "#44403c", // strong secondary text
          100: "#292524", // near-primary heading
          50:  "#1c1917", // primary text / headings  (also text-on-accent)
        },
        // Single accent — emerald. Doubles as the "positive money" hue.
        gold: {
          DEFAULT: "#059669",
          50:  "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#047857", // button hover / darker accent
          400: "#059669", // primary accent (buttons, links, active)
          500: "#047857",
          600: "#065f46",
          700: "#064e3b",
        },
      },
      fontFamily: {
        sans:    ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono:    ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 0 0 1px rgba(17,24,39,0.05), 0 1px 2px rgba(17,24,39,0.04), 0 4px 16px rgba(17,24,39,0.05)",
        "card-hover": "0 0 0 1px rgba(5,150,105,0.25), 0 4px 20px rgba(17,24,39,0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
