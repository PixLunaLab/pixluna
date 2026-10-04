import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  outDir: "lib",
  target: "es2022",
  dts: true,
  minify: true,
  clean: true,
  outExtensions({ format }) {
    return {
      js: format === "es" ? ".mjs" : ".cjs",
      dts: format === "es" ? ".d.ts" : ".d.cts"
    }
  }
})
