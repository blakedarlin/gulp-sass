const config = {
	verbose: true,
	transform: {
		'^.+\\.(t|j)sx?$': '@swc/jest',
	},
	collectCoverage: true,
	collectCoverageFrom: ['./index.js'],
	coverageThreshold: { global: { lines: 90 } },
	testEnvironment: 'node',
};
export default config;
