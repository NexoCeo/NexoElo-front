import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { loadEnv, type ProxyOptions } from "vite";

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

    plugins: [react()],

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
