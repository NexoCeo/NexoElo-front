import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { loadEnv, type ProxyOptions } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "VITE_");

  const backendOrigin = (
    env.VITE_API_ORIGIN ||
    "https://nexoelo.onrender.com"
  ).replace(/\/$/, "");

  const proxyTarget: ProxyOptions = {
    target: backendOrigin,
    changeOrigin: true,
    secure: true,
  };

  return {
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },

    plugins: [
      react(),

      VitePWA({
        registerType: "autoUpdate",

        includeAssets: [
          "favicon.ico",
          "apple-touch-icon.png",
          "pwa-192x192.png",
          "pwa-512x512.png",
        ],

        manifest: {
          name: "NexoElo",
          short_name: "NexoElo",

          description: "Plataforma NexoElo",

          theme_color: "#ffffff",
          background_color: "#ffffff",

          display: "standalone",

          start_url: "/",
          scope: "/",

          icons: [
            {
              src: "/pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },

        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
        },

        devOptions: {
          enabled: true,
        },
      }),
    ],

    server: {
      proxy: {
        "/api": proxyTarget,
        "/uploads": proxyTarget,
        "/hubs": proxyTarget,
      },
    },

    preview: {
      proxy: {
        "/api": proxyTarget,
        "/uploads": proxyTarget,
        "/hubs": proxyTarget,
      },
    },

    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      css: true,
      globals: true,
    },
  };
});
