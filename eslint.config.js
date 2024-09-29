import eslint from '@eslint/js';
import globals from 'globals';

import jestPlugin from 'eslint-plugin-jest';
import eslintPluginImportX from 'eslint-plugin-import-x';
import unicornPlugin from 'eslint-plugin-unicorn';
import prettierConfig from 'eslint-config-prettier';

export default [
	{
		ignores: [
			'**/node_modules/**',
			'**/.yarn',
			'**/.pnp.*',
			'**/build/**',
			'**/dist/**',
			'coverage',
			'docker',
		],
	},

	// Turns off all rules that are unnecessary or might conflict with Prettier.
	prettierConfig,

	// recommended eslint config
	eslint.configs.recommended,

	// Recommended import rules
	eslintPluginImportX.flatConfigs.recommended,

	// More than 100 powerful ESLint rules
	unicornPlugin.configs['flat/recommended'],

	{
		languageOptions: {
			globals: {
				...globals.node,
			},
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
				projectService: true,
			},
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
];
