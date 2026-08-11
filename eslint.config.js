import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';
import jestPlugin from 'eslint-plugin-jest';
import eslintPluginImportX, {
	flatConfigs as importXFlatConfigs,
} from 'eslint-plugin-import-x';
import unicornPlugin from 'eslint-plugin-unicorn';
import prettierConfig from 'eslint-config-prettier';

export default defineConfig([
	globalIgnores([
		'**/node_modules/**',
		'**/.yarn',
		'**/.pnp.*',
		'**/build/**',
		'**/dist/**',
		'coverage',
		'docker',
	]),

	{
		files: ['**/*.js'],
		plugins: { js },
		extends: ['js/recommended'],
	},

	// Recommended import rules
	importXFlatConfigs.recommended,

	// More than 100 powerful ESLint rules
	unicornPlugin.configs.recommended,

	{
		languageOptions: {
			globals: {
				...globals.node,
			},
			ecmaVersion: 'latest',
			sourceType: 'module',
		},
		plugins: {
			import: eslintPluginImportX,
		},
		rules: {
			'import/order': [
				'error',
				{
					groups: [
						'external',
						'builtin',
						'internal',
						'sibling',
						'parent',
						'index',
					],
					'newlines-between': 'always',
				},
			],
		},
	},
	// ESLint plugin for Jest
	{
		files: ['**/*.test.js'],
		...jestPlugin.configs['flat/recommended'],
	},

	// Turns off all rules that are unnecessary or might conflict with Prettier.
	prettierConfig,
]);
