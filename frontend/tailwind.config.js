/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg:      "#0D1117",
          surface: "#161B22",
          border:  "#30363D",
          green:   "#3FB950",
          red:     "#F85149",
          gold:    "#D4A017",
          text:    "#E6EDF3",
          muted:   "#8B949E",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
