export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        background: "#050509",
        surface: "#16161f",
        raised: "#1c1c28",
        foreground: "#f5f3ee",
        "foreground-muted": "rgba(245,243,238,.55)",
        primary: { DEFAULT: "#ff6a00", light: "#ff8c3a" },
        accent: "#00c8e8",
        violet: "#6d28d9",
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
        twinkle: {
          "0%, 100%": { opacity: "var(--twinkle-min, 0.15)" },
          "50%": { opacity: "var(--twinkle-max, 0.9)" },
        },
        "spin-glow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "pulse-dot": {
          "0%, 80%, 100%": { opacity: "0.25", transform: "scale(0.8)" },
          "40%": { opacity: "1", transform: "scale(1.15)" },
        },
      },
      animation: {
        snowfall: "snowfall linear infinite",
        twinkle: "twinkle ease-in-out infinite",
        "spin-glow": "spin-glow 3s linear infinite",
        "pulse-dot": "pulse-dot 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
