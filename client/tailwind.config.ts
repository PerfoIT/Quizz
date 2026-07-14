import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        perfo: {
          blue: "#1D6DFF",
          cyan: "#37D6FF",
          navy: "#07111F",
          ink: "#030712"
        }
      },
      boxShadow: {
        glow: "0 0 50px rgba(29, 109, 255, 0.25)"
      }
    }
  },
  plugins: []
} satisfies Config;

