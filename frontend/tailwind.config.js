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
    },
  },
  plugins: [],
};
