import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{html,ts}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      // keep your colors / radius / keyframes / animation exactly as-is
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
