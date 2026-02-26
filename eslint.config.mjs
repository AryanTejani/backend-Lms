import js from "@eslint/js";
import tseslint from "typescript-eslint";
import unusedImportsPlugin from "eslint-plugin-unused-imports";
import importPlugin from "eslint-plugin-import";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default [
  // Ignore files and directories
  {
    ignores: ["dist", "node_modules", "migrations"],
  },

  // Recommended configurations from ESLint
  js.configs.recommended,

  // Recommended configurations from TypeScript
  ...tseslint.configs.recommended,

  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "unused-imports": unusedImportsPlugin,
      "import": importPlugin,
    },

    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.mocha,
        ...globals.jest,
      },

      parserOptions: {
        project: [
          "./apps/main-panel/tsconfig.app.json",
          "./apps/admin-panel/tsconfig.app.json",
          "./apps/mobile-api/tsconfig.app.json",
          "./libs/shared/tsconfig.lib.json",
          "./libs/auth/tsconfig.lib.json",
          "./libs/content/tsconfig.lib.json",
          "./libs/billing/tsconfig.lib.json",
          "./libs/customer/tsconfig.lib.json",
        ],
        ecmaVersion: 2024,
        sourceType: "module",
        tsconfigRootDir: __dirname,
      },
    },

    rules: {
      // Code quality rules (formatting handled by Prettier)
      "curly": ["error", "all"],
      "brace-style": ["error", "1tbs"],
      "no-restricted-syntax": ["error", "ForInStatement", "LabeledStatement", "WithStatement"],
      "no-param-reassign": ["error", { "props": true }],
      "newline-after-var": "error",
      "newline-before-return": "error",
      "padding-line-between-statements": [
        "error",
        {
          "blankLine": "always",
          "prev": "*",
          "next": ["if", "for", "while", "do", "switch", "try"]
        },
        {
          "blankLine": "always",
          "prev": ["if", "for", "while", "do", "switch", "try"],
          "next": "*"
        }
      ],
      "no-shadow": "off",
      "no-useless-constructor": "off",
      "no-empty-function": "off",
      "no-await-in-loop": "off",
      "no-continue": "off",
      "no-bitwise": "off",

      // TypeScript-specific rules
      "@typescript-eslint/no-shadow": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrors": "none"
        }
      ],
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/ban-ts-comment": "off",

      // Import rules
      "unused-imports/no-unused-imports": "error",
      "import/no-extraneous-dependencies": "error",
    },
  },
];
