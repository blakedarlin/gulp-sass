module.exports = {
	bracketSpacing: true,
	printWidth: 80,
	proseWrap: 'preserve',
	semi: true,
	singleQuote: true,
	trailingComma: 'all',
	tabWidth: 4,
	useTabs: true,
	arrowParens: 'always',
	requirePragma: false,
	insertPragma: false,
	endOfLine: 'lf',
	overrides: [
		{
			files: '*.json',
			options: {
				singleQuote: false,
			},
		},
		{
			files: '.*rc',
			options: {
				singleQuote: false,
				parser: 'json',
			},
		},
	],
};
