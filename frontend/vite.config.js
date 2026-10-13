import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// One-address routing: every backend service is also reachable under
// /svc/<name> on the frontend's own address. Used when the app is opened
// through a single public link (scripts/start-tunnel.sh), where the
// browser cannot reach ports 3001/5002/8000/5005/5010 directly. On the LAN
// the frontend still calls those ports itself (frontend/.env), so this
// changes nothing there.
const route = (port, ws = false) => ({
  target: `http://127.0.0.1:${port}`,
  changeOrigin: true,
  ws,
  rewrite: (p) => p.replace(/^\/svc\/[a-z]+/, ""),
});
const serviceProxy = {
  "/svc/auth": route(3001),
  "/svc/emotion": route(5002),
  "/svc/class": route(8000, true), // WebSockets: live-class signalling
  "/svc/learn": route(5005),
  "/svc/analytics": route(5010),
};
// Hosts allowed besides localhost and the LAN IP: Cloudflare quick tunnels.
const tunnelHosts = [".trycloudflare.com"];

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      target: "react",
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.js",
      disableTypes: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 3002,
    strictPort: false,
    // Binds all interfaces, not just localhost - required for other
    // laptops on the same LAN (e.g. a live-class demo) to reach this dev
    // server via this machine's LAN IP instead of only 127.0.0.1.
    host: true,
    proxy: serviceProxy,
    allowedHosts: tunnelHosts,
  },
  // `vite preview` serves the built app for the public link.
  preview: {
    port: 3003,
    strictPort: true,
    host: "127.0.0.1",
    proxy: serviceProxy,
    allowedHosts: tunnelHosts,
  },
});
