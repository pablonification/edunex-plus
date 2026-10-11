import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// The window (src/app). Built into dist/app and served from app://edunex-plus
// in the app; in development the dev server runs on 127.0.0.1 only.
export default defineConfig({
  root: path.resolve(__dirname, "src/app"),
  base: "./",
  plugins: [react(), tailwindcss()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  build: { outDir: path.resolve(__dirname, "dist/app"), emptyOutDir: true, target: "chrome140", sourcemap: false },
});
