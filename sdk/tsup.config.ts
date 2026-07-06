import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2020",
    jsx: "react",
    external: ["react", "react-native", "@stellar/stellar-sdk"],
    outExtension({ format }) {
      return {
        js: format === "esm" ? ".mjs" : ".cjs",
      };
    },
  },
  {
    entry: ["src/react-native/index.ts"],
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "esnext",
    outDir: "dist/react-native",
    external: ["react", "react-native", "@stellar/stellar-sdk"],
    platform: "browser",
    outExtension() {
      return { js: ".js" };
    },
  },
]);
