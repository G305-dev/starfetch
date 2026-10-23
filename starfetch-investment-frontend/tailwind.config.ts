import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        star: {
          50: "#F7FAED",
          100: "#EDF6DE",
          200: "#D9EAC8",
          300: "#B7D7A4",
          500: "#2E7253",
          700: "#075038",
          800: "#073E2D",
          900: "#003B2A",
          ink: "#12372A",
          muted: "#607668",
          lime: "#B9ED1D",
          limeDark: "#80AF14",
        },
      },
      boxShadow: {
        card: "0 7px 20px rgba(0, 59, 42, 0.07)",
        image: "0 18px 40px rgba(0, 59, 42, 0.18)",
      },
      fontFamily: {
        display: ["var(--font-manrope)", "sans-serif"],
        body: ["var(--font-manrope)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
