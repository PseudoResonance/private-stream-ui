// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginSortKeysFix from "eslint-plugin-sort-keys-fix";
import eslintPluginTsSortKeys from "eslint-plugin-typescript-sort-keys";
import globals from "globals";
import jsdoc from "eslint-plugin-jsdoc";
import { configs as litConfigs } from "eslint-plugin-lit";

export default [
	jsdoc.configs["flat/recommended"],
	litConfigs["flat/recommended"],
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["src/**/*.{js,jsx,mjs,cjs,ts,tsx}"],
		plugins: {
			tseslint,
			"sort-keys-fix": eslintPluginSortKeysFix,
			"typescript-sort-keys": eslintPluginTsSortKeys,
		},
		languageOptions: {
			parserOptions: {
				project: true,
				tsconfigRootDir: import.meta.dirname,
				ecmaFeatures: {
					jsx: true,
				},
			},
			globals: {
				...globals.serviceworker,
				...globals.browser,
				React: true,
				JSX: true,
			},
			parser: tseslint.parser,
		},
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
					destructuredArrayIgnorePattern: "^_",
					varsIgnorePattern: "^_",
				},
			],
			"sort-keys-fix/sort-keys-fix": ["warn"],
			"typescript-sort-keys/interface": ["warn"],
			"typescript-sort-keys/string-enum": ["warn"],
			"no-console": ["warn"],
			"capitalized-comments": [
				"warn",
				"always",
				{
					ignorePattern: "prettier-",
				},
			],
			"jsdoc/tag-lines": ["warn", "any", { startLines: 1 }],
			"jsdoc/require-description-complete-sentence": ["warn"],
			"jsdoc/check-line-alignment": ["warn"],
			"jsdoc/require-asterisk-prefix": ["error"],
			"jsdoc/require-param-type": "off",
			"jsdoc/require-returns-type": "off",
			"jsdoc/no-undefined-types": "off",
			"jsdoc/require-jsdoc": ["off"],
		},
		settings: {
			react: {
				version: "detect",
			},
		},
	},
];
