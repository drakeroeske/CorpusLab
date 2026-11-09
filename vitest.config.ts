import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Reuses the app's Vite setup (React plugin, "@" alias). Vite's root is client/, so paths are relative to it.
export default mergeConfig(viteConfig, defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
  },
}));
