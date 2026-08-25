// ESLint flat config. Only lints the project's own TypeScript source —
// build output and uploaded files are never worth linting.
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "uploads/"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Express's own types use `{}` as the "no params/body" placeholder
      // (e.g. Request<{}, {}, ChatRequestBody>) — that's the idiomatic
      // pattern here, not a mistake.
      "@typescript-eslint/no-empty-object-type": ["error", { allowObjectTypes: "always" }],
    },
  },
);
