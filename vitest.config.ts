import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./lib/__tests__/setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      // server-only throws outside Next's react-server condition; tests run
      // server-side already, so map it to an inert stub.
      "server-only": path.resolve(
        __dirname,
        "lib/__tests__/server-only-stub.ts",
      ),
      "~": path.resolve(__dirname),
    },
  },
});
