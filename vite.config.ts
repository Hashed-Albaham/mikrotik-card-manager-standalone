import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "MikroTik Card Manager",
        short_name: "Card Manager",
        description: "Offline MikroTik card generation, export and printing.",
        theme_color: "#0f2747",
        background_color: "#f4f7fb",
        display: "standalone",
        start_url: "/",
        lang: "ar",
        dir: "rtl",
        icons: [{ src: "/icon.png", sizes: "1024x1024", type: "image/png", purpose: "any maskable" }]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "index.html"
      }
    })
  ]
});
