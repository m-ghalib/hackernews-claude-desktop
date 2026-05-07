import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Default: exclude network tests so `npm test` only runs unit tests
    exclude: ["tests/network/**", "node_modules/**"],
  },
});
