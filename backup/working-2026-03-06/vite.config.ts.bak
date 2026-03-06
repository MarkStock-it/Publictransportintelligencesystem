import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// Use root in dev and GitHub Pages path in production.
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/Publictransportintelligencesystem/" : "/",
  plugins: [react(), tailwindcss()],
}))