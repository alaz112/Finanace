/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        fin: {
          bg:       "#F7F8FA",
          white:    "#FFFFFF",
          border:   "#E8EBF0",
          text:     "#1A1D23",
          muted:    "#6B7280",
          subtle:   "#9CA3AF",
          green:    "#00C076",
          greenBg:  "#E6FAF3",
          red:      "#FF3B30",
          redBg:    "#FFF0EF",
          blue:     "#2563EB",
          blueBg:   "#EFF6FF",
          gold:     "#F59E0B",
          goldBg:   "#FFFBEB",
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "sans-serif"],
        mono: ["SF Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};
