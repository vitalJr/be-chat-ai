import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "uploads/"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-empty-object-type": ["error", { allowObjectTypes: "always" }],
    },
  },
);
