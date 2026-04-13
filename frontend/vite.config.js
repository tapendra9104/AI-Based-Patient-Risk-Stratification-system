import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ============================================
// Vite Configuration
// ============================================
// - React plugin for JSX support
// - Dev server on port 3000
// - Proxy /api requests to the Node.js backend (port 5000)
//   so we don't get CORS issues during development

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
