// Without this, Vitest also picks up compiled test files under dist/
// (created by `npm run build`) alongside the real ones in src/, running
// every test twice.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
