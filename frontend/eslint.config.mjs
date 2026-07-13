import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      "@next/next/no-img-element": "off",
      // react-hook-form exposes a watch API that the React compiler rule currently flags.
      "react-hooks/incompatible-library": "off",
      // Existing data-loading effects intentionally update local request state.
      "react-hooks/set-state-in-effect": "off"
    }
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"])
]);
