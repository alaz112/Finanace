/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        apple: {
          bg:        "#F5F5F7",
          surface:   "#FFFFFF",
          elevated:  "#FBFBFD",
          separator: "rgba(0,0,0,0.08)",
          label:     "#1D1D1F",
          secondary: "#6E6E73",
          tertiary:  "#AEAEB2",
          green:     "#34C759",
          greenBg:   "#F0FFF4",
          red:       "#FF3B30",
          redBg:     "#FFF5F5",
          blue:      "#007AFF",
          blueBg:    "#F0F8FF",
          orange:    "#FF9500",
          orangeBg:  "#FFFAF0",
          gold:      "#FFD60A",
          indigo:    "#5856D6",
        },
      },
      boxShadow: {
        apple: "0 2px 8px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.04)",
        "apple-md": "0 4px 16px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.04)",
        "apple-lg": "0 8px 32px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.04)",
      },
      borderRadius: {
        apple: "16px",
        "apple-sm": "10px",
        "apple-lg": "20px",
      },
    },
  },
  plugins: [],
};
