/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        wildcard: {
          green: "#22c55e",
          red: "#ef4444",
          yellow: "#eab308",
          blue: "#3b82f6",
          black: "#1a1a2e",
        },
      },
    },
  },
  plugins: [],
};
