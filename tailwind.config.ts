import type { Config } from "tailwindcss";

const config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#F0534F",
        brand: { coral: "#F0534F", dark: "#1D1D1D" },
        background: "#F8F8F8",
        surface: "#FFFFFF",
        text: {
          primary: "#1D1D1D",
          secondary: "#595959",
          tertiary: "#848484",
          dark: "#333333",
          placeholder: "#ACACAC",
        },
        border: "rgb(130 130 130 / 70%)",
        divider: "#E7E7E7",
        success: "#2E9E5B",
        error: "#D64545",
      },
      borderRadius: {
        button: "0.625rem",
        card: "0.625rem",
        input: "0.5rem",
        badge: "1.25rem",
      },
      fontFamily: {
        sans: ["Poppins", "Montserrat", "Arial", "sans-serif"],
        brand: ["Montserrat", "Arial", "sans-serif"],
      },
      fontSize: {
        badge: ["0.8125rem", { lineHeight: "1.25rem" }],
        label: ["0.875rem", { lineHeight: "1.25rem" }],
        button: ["1rem", { lineHeight: "1.5rem", fontWeight: "500" }],
        title: ["1.25rem", { lineHeight: "1.75rem", fontWeight: "600" }],
        logo: ["2.5rem", { lineHeight: "3rem", fontWeight: "800" }],
      },
      spacing: {
        xs: "0.25rem",
        sm: "0.5rem",
        md: "1rem",
        lg: "1.5rem",
        xl: "2rem",
      },
      minHeight: { button: "3.125rem" },
      opacity: { disabled: "0.4" },
      boxShadow: { card: "0 2px 10px rgb(29 29 29 / 4%)" },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
