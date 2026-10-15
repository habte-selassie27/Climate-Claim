import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // The GenLayer SDK is the single largest dependency (~530 kB
          // minified). Isolating it keeps it out of the first-paint shell and
          // lets it be cached independently of app code.
          "genlayer-sdk": ["genlayer-js"],
          react: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
    // The isolated SDK chunk is ~531 kB minified, which trips the default
    // 500 kB advisory. The first-paint shell is ~184 kB, so this is expected
    // and scoped to the vendor chunk rather than a regression.
    chunkSizeWarningLimit: 600,
  },
});
