import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  outDir: "dist",
  platform: "node",
  splitting: false,
  noExternal: [/.*/],
  clean: true,
  outExtension() {
    return { js: ".cjs" };
  },
  banner: {
    js: "#!/usr/bin/env node",
  },
});
