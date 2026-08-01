import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {jsx: true},
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "@typescript-eslint": tseslint,
    },
    rules: {
      // The whole point of this lint pass — tsc cannot catch hook-order bugs.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {ecmaVersion: "latest", sourceType: "module"},
  },
];
