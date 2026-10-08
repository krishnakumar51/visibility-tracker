import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

const dashboardDataPath = fileURLToPath(new URL("../outputs/dashboard_data.json", import.meta.url));

function pipelineDashboardData(): Plugin {
  return {
    name: "pipeline-dashboard-data",
    configureServer(server) {
      server.middlewares.use("/dashboard_data.json", async (_request, response, next) => {
        try {
          const body = await readFile(dashboardDataPath);
          response.statusCode = 200;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          response.end(body);
        } catch (error) {
          next(error);
        }
      });
    },
    async writeBundle(options) {
      const outputDirectory = resolve(options.dir ?? "dist");
      await mkdir(outputDirectory, { recursive: true });
      try {
        await readFile(dashboardDataPath);
        await copyFile(dashboardDataPath, resolve(outputDirectory, "dashboard_data.json"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    },
  };
}

export default defineConfig({
  plugins: [
    pipelineDashboardData(),
    tanstackRouter({ target: "react", autoCodeSplitting: false }),
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
