export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0f",
        surface: "#16161f",
        raised: "#1c1c28",
        foreground: "#f5f3ee",
        "foreground-muted": "rgba(245,243,238,.55)",
        primary: { DEFAULT: "#ff6b00", light: "#ff8c3a" },
        accent: "#00d4ff",
        border: "rgba(255,255,255,.08)",
      },
      fontFamily: {
        display: ["Bebas Neue", "sans-serif"],
        body: ["Poppins", "sans-serif"],
      },
      keyframes: {
        snowfall: {
          "0%": { transform: "translateY(-10%) translateX(0)", opacity: 0 },
          "10%": { opacity: "var(--flake-opacity, 0.85)" },
          "90%": { opacity: "var(--flake-opacity, 0.85)" },
          "100%": { transform: "translateY(120%) translateX(var(--flake-drift, 12px))", opacity: 0 },
        },
      },
      animation: {
        snowfall: "snowfall linear infinite",
      },
    },
  },
  plugins: [],
};
