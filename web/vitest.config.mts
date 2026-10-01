import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root("."),
      // The real package throws outside a React Server Components build.
      "server-only": root("./lib/speedtest/__stubs__/server-only.ts"),
    },
  },
});
