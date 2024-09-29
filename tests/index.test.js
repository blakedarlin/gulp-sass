/* eslint-disable unicorn/no-null */
/* eslint-disable unicorn/prefer-module */
import gulp from 'gulp';
import { Transform } from 'streamx';
import Vinyl from 'vinyl';
import replaceExtension from 'replace-ext';
import PluginError from 'plugin-error';
import * as sassEmbedded from 'sass-embedded';

import * as url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

import sass, { createCompileArguments, formatSassError } from '../index.js';

const createVinyl = (filename, contents) => {
	const base = path.join(__dirname, 'scss');
	const filePath = path.join(base, filename);

	return new Vinyl({
		cwd: __dirname,
		base,
		path: filePath,
		contents: Buffer.from(contents || fs.readFileSync(filePath)),
	});
};

const initializeStream = (options = {}) => sass(options);

const writeFileToStream = async (stream, files) => {
	const isMultiple = Array.isArray(files);
	const fileArray = isMultiple ? files : [files];

	return new Promise((resolve, reject) => {
		const results = [];

		const dataHandler = (data) => {
			results.push(data);
		};

		const errorHandler = (error) => {
			cleanup();
			reject(error);
		};

		const endHandler = () => {
			cleanup();
			resolve(isMultiple ? results : results[0]);
		};

		const cleanup = () => {
			stream.off('data', dataHandler);
			stream.off('error', errorHandler);
			stream.off('end', endHandler);
		};

		stream.on('data', dataHandler);
		stream.on('error', errorHandler);
		stream.on('end', endHandler);

		for (const file of fileArray) {
			stream.write(file);
		}
		stream.end();
	});
};

const getCompiledAndExpected = (cssFile, expectedName) => {
	const expectedPath = path.join(
		__dirname,
		'expected',
		replaceExtension(path.basename(expectedName || cssFile.path), '.css'),
	);
	const expected = fs.readFileSync(expectedPath, 'utf8').trim();
	const actual = cssFile.contents.toString().trim();

	return { actual, expected };
};

describe('Sass compiler initialization and error handling', () => {
	let emptyFile;

	beforeEach(() => {
		emptyFile = {
			isNull: () => true,
		};
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('sets up the async compiler', async () => {
		const stream = sass();
		await writeFileToStream(stream, emptyFile);
		expect(stream.isCompilerInitialized()).toBe(true);
	});
	it('sets up the sync compiler', async () => {
		const stream = sass.sync();
		await writeFileToStream(stream, emptyFile);
		expect(stream.isCompilerInitialized()).toBe(true);
	});

	it('handles error in open method when initializing async compiler', async () => {
		jest.spyOn(sassEmbedded, 'initAsyncCompiler').mockRejectedValue(
			new Error('Initialization error'),
		);

		const stream = sass();

		await expect(writeFileToStream(stream, emptyFile)).rejects.toThrow(
			'Initialization error',
		);
	});

	it('handles error in destroy method when disposing async compiler', async () => {
		const mockCompiler = {
			compileStringAsync: jest.fn().mockResolvedValue({ css: '' }),
			dispose: jest.fn().mockRejectedValue(new Error('Dispose error')),
		};
		jest.spyOn(sassEmbedded, 'initAsyncCompiler').mockResolvedValue(
			mockCompiler,
		);

		const stream = sass();

		const errorPromise = new Promise((resolve) => {
			stream.once('error', resolve);
		});

		writeFileToStream(stream, emptyFile);

		await expect(errorPromise).resolves.toMatchObject({
			constructor: PluginError,
			message: 'Dispose error',
		});
		expect(mockCompiler.dispose).toHaveBeenCalled();
	});

	it('handles error in open method when initializing sync compiler', async () => {
		jest.spyOn(sassEmbedded, 'initCompiler').mockImplementation(() => {
			throw new Error('Initialization error');
		});

		const stream = sass({ sync: true });

		await expect(writeFileToStream(stream, emptyFile)).rejects.toThrow(
			'Initialization error',
		);
	});

	it('handles error in destroy method when disposing sync compiler', async () => {
		const mockCompiler = {
			compileString: jest.fn().mockReturnValue({ css: '' }),
			dispose: jest.fn(() => {
				throw new Error('Dispose error');
			}),
		};
		jest.spyOn(sassEmbedded, 'initCompiler').mockReturnValue(mockCompiler);

		const stream = sass({ sync: true });

		const errorPromise = new Promise((resolve) => {
			stream.once('error', resolve);
		});

		writeFileToStream(stream, emptyFile);

		await expect(errorPromise).resolves.toMatchObject({
			constructor: PluginError,
			message: 'Dispose error',
		});
		expect(mockCompiler.dispose).toHaveBeenCalled();
	});
});

describe('createCompileArguments', () => {
	beforeEach(() => {
		jest.spyOn(url, 'pathToFileURL').mockImplementation(
			(path) => `file://${path}`,
		);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('correctly creates compile arguments', () => {
		const mockFile = {
			path: '/path/to/styles.scss',
			extname: '.scss',
			dirname: '/path/to',
			sourceMap: true,
			contents: Buffer.from('body { color: red; }'),
		};

		const options = {
			loadPaths: ['/custom/path'],
			outputStyle: 'compressed',
		};

		const result = createCompileArguments(mockFile, options);

		expect(result).toHaveLength(2);
		expect(result[0]).toBe('body { color: red; }');
		expect(result[1]).toEqual({
			loadPaths: expect.arrayContaining(['/path/to', '/custom/path']),
			outputStyle: 'compressed',
			url: new URL('file:///path/to/styles.scss'),
			sourceMap: true,
			sourceMapIncludeSources: true,
			syntax: 'scss',
		});
	});

	it('handles different file extensions', () => {
		// eslint-disable-next-line unicorn/consistent-function-scoping
		const testExtension = (extname, expectedSyntax) => {
			const mockFile = {
				path: `/path/to/styles${extname}`,
				extname,
				dirname: '/path/to',
				contents: Buffer.from(''),
			};

			const [, options] = createCompileArguments(mockFile);
			expect(options.syntax).toBe(expectedSyntax);
		};

		testExtension('.scss', 'scss');
		testExtension('.sass', 'indented');
		testExtension('.css', 'css');
		testExtension('.less', 'scss'); // Default case
	});

	it('handles null file', () => {
		const result = createCompileArguments(null);
		expect(result[0]).toBe('');
		expect(result[1].loadPaths).toEqual([]);
	});
});

describe('formatSassError', () => {
	it('formats error with span information', () => {
		const error = {
			span: {
				start: {
					line: 5,
					column: 10,
				},
			},
			message: 'Sass error occurred',
		};

		const formattedError = formatSassError(error);

		expect(formattedError.line).toBe(6);
		expect(formattedError.column).toBe(11);
		expect(formattedError.messageOriginal).toBe('Sass error occurred');
		expect(formattedError.messageFormatted).toBe('Sass error occurred');
	});

	it('handles error without span information', () => {
		const error = {
			message: 'Generic error',
		};

		const formattedError = formatSassError(error);

		expect(formattedError.line).toBeUndefined();
		expect(formattedError.column).toBeUndefined();
		expect(formattedError.messageOriginal).toBe('Generic error');
		expect(formattedError.messageFormatted).toBe('Generic error');
	});

	it('handles error without line and column', () => {
		const error = {
			message: 'Generic error',
			span: {
				start: {},
			},
		};

		const formattedError = formatSassError(error);

		expect(formattedError.line).toBe(1);
		expect(formattedError.column).toBe(1);
		expect(formattedError.messageOriginal).toBe('Generic error');
		expect(formattedError.messageFormatted).toBe('Generic error');
	});

	it('uses sassMessage if available', () => {
		const error = {
			sassMessage: 'Specific Sass error',
			message: 'Generic error message',
		};

		const formattedError = formatSassError(error);

		expect(formattedError.messageOriginal).toBe('Specific Sass error');
		expect(formattedError.messageFormatted).toBe('Generic error message');
	});

	it('handles null or undefined error', () => {
		expect(() => formatSassError(null)).not.toThrow();
		expect(() => formatSassError()).not.toThrow();
	});
});

describe('async compile', () => {
	let stream;

	beforeEach(() => (stream = initializeStream({ style: 'compressed' })));

	it('passes file when it isNull()', async () => {
		const emptyFile = {
			isNull: () => true,
		};
		const data = await writeFileToStream(stream, emptyFile);
		expect(data).toEqual(emptyFile);
	});

	it('emits error when file isStream()', async () => {
		const streamFile = {
			isStream: () => true,
			isNull: () => false,
		};
		await expect(writeFileToStream(stream, streamFile)).rejects.toThrow(
			'Streams are not supported!',
		);
	});

	it('compiles an empty sass file', async () => {
		const emptyFile = createVinyl('empty.scss', '');
		const data = await writeFileToStream(stream, emptyFile);
		expect(data.contents.toString()).toBe('');
		expect(data.path).toMatch(/\.css$/);
	});

	it('compiles a single sass file', async () => {
		const sassFile = createVinyl('style.scss', 'body { color: red; }');
		const data = await writeFileToStream(stream, sassFile);
		expect(data.contents.toString()).toContain('body{color:red}');
		expect(data.path).toMatch(/\.css$/);
	});

	it('compiles multiple sass files', async () => {
		const files = [
			createVinyl('mixins.scss'),
			createVinyl('variables.scss'),
		];

		const data = await writeFileToStream(stream, files);

		expect(data.length).toBe(files.length);

		for (const cssFile of data) {
			expect(cssFile).toBeTruthy();
			expect(cssFile.path).toBeTruthy();
			expect(cssFile.relative).toBeTruthy();
			expect(cssFile.contents).toBeTruthy();

			const { actual, expected } = getCompiledAndExpected(cssFile);
			expect(actual).toBe(expected);
		}
	});

	it('handles invalid Sass syntax', async () => {
		const invalidFile = createVinyl('invalid.scss', 'body { font: ; }');
		await expect(writeFileToStream(stream, invalidFile)).rejects.toThrow(
			'Expected expression',
		);
	});

	it('gets a sass error object', async () => {
		const errorFile = createVinyl('error.scss');
		await expect(writeFileToStream(stream, errorFile)).rejects.toThrow(
			expect.objectContaining({
				sassMessage: 'expected "{".',
				sassStack: expect.stringContaining(
					path.join('tests', 'scss', 'error.scss'),
				),
			}),
		);
	});

	it('compiles a large Sass file', async () => {
		const largeContent = 'body { color: red; }'.repeat(10_000);
		const largeFile = createVinyl('large.scss', largeContent);
		const data = await writeFileToStream(stream, largeFile);
		expect(data.contents.toString()).toContain('body{color:red}');
		expect(data.path).toMatch(/\.css$/);
	});

	it('compiles with expanded style', async () => {
		const sassFile = createVinyl('style.scss', 'body { color: red; }');
		const stream = initializeStream({ style: 'expanded' });
		const data = await writeFileToStream(stream, sassFile);
		expect(data.contents.toString()).toContain('body {\n  color: red;\n}');
		expect(data.path).toMatch(/\.css$/);
	});

	it('skips partials', async () => {
		const files = [
			createVinyl('_partial.scss'),
			createVinyl('variables.scss'),
		];

		const data = await writeFileToStream(stream, files);

		// Check that only one file was processed (the non-partial)
		expect(data.length).toBe(1);

		const cssFile = data[0];
		expect(cssFile).toBeTruthy();
		expect(cssFile.path).toBeTruthy();
		expect(cssFile.relative).toBeTruthy();
		expect(cssFile.contents).toBeTruthy();

		// Ensure the processed file is not the partial
		expect(path.basename(cssFile.path)).not.toBe('_partial.css');

		const { actual, expected } = getCompiledAndExpected(cssFile);
		expect(actual).toBe(expected);
	});

	it('compiles files with partials in another folder', async () => {
		const sassFile = createVinyl('inheritance.scss');

		const data = await writeFileToStream(stream, sassFile);
		expect(data).toBeTruthy();
		expect(data.path).toBeTruthy();
		expect(data.relative).toBeTruthy();
		expect(data.contents).toBeTruthy();

		const { actual, expected } = getCompiledAndExpected(data);
		expect(actual).toBe(expected);
	});

	it('compiles a single sass file if the file name has been changed in the stream', async () => {
		const sassFile = createVinyl('mixins.scss');
		// Transform file name
		sassFile.path = path.join(__dirname, 'scss', 'mixin--changed.scss');

		const data = await writeFileToStream(stream, sassFile);
		expect(data).toBeTruthy();
		expect(data.path).toBeTruthy();
		expect(data.contents).toBeTruthy();
		expect(data.path.split(path.sep).pop()).toBe('mixin--changed.css');
		const { actual, expected } = getCompiledAndExpected(data, 'mixins.css');
		expect(actual).toBe(expected);
	});

	it('preserves changes made in-stream to a Sass file', async () => {
		const sassFile = createVinyl('mixins.scss');
		sassFile.contents = Buffer.from(
			`.added-dynamically { color: red }${sassFile.contents.toString()}`,
		);
		const data = await writeFileToStream(stream, sassFile);
		expect(data).toBeTruthy();
		expect(data.path).toBeTruthy();
		expect(data.contents).toBeTruthy();
		let { actual, expected } = getCompiledAndExpected(data);
		expected = `.added-dynamically{color:red}${expected}`;
		expect(actual).toBe(expected);
	});

	it('compiles a single indented sass file', async () => {
		const sassFile = createVinyl('indent.sass');

		const data = await writeFileToStream(stream, sassFile);
		expect(data).toBeTruthy();
		expect(data.path).toBeTruthy();
		expect(data.contents).toBeTruthy();
		const { actual, expected } = getCompiledAndExpected(data);
		expect(actual).toBe(expected);
	});

	it('compiles a single css file', async () => {
		const sassFile = createVinyl('css.css');

		const data = await writeFileToStream(stream, sassFile);
		expect(data).toBeTruthy();
		expect(data.path).toBeTruthy();
		expect(data.contents).toBeTruthy();
		const { actual, expected } = getCompiledAndExpected(data);
		expect(actual).toBe(expected);
	});

	it('parses files in sass and scss', async () => {
		const files = [createVinyl('mixins.scss'), createVinyl('indent.sass')];
		const data = await writeFileToStream(stream, files);
		expect(data.length).toBe(files.length);
		for (const cssFile of data) {
			expect(cssFile).toBeTruthy();
			expect(cssFile.path).toBeTruthy();
			expect(cssFile.relative).toBeTruthy();
			expect(cssFile.contents).toBeTruthy();

			const { actual, expected } = getCompiledAndExpected(cssFile);
			expect(actual).toBe(expected);
		}
	});

	it('updates file time stats to current date', async () => {
		const sassFile = createVinyl('style.scss', 'body { color: red; }');
		const originalDate = new Date(2020, 0, 1);
		sassFile.stat = { mtime: originalDate };

		const data = await writeFileToStream(stream, sassFile);
		expect(data.stat.mtime).toBeInstanceOf(Date);
		expect(data.stat.mtime.getTime()).toBeGreaterThan(
			originalDate.getTime(),
		);
		const now = new Date();
		const timeDifference = now.getTime() - data.stat.mtime.getTime();
		expect(timeDifference).toBeLessThan(1000);
	});

	it('works with sourcemaps', async () => {
		const expectedSources = [
			'includes/_cats.scss',
			'includes/_dogs.sass',
			'inheritance.scss',
		].map(
			(file) =>
				url.pathToFileURL(path.join(__dirname, 'scss', file)).href,
		);

		const sourcesTransformTest = () =>
			new Transform({
				transform(file, callback) {
					try {
						expect(file.sourceMap).toBeTruthy();
						expect(file.sourceMap.sources.sort()).toEqual(
							expectedSources.sort(),
						);
						callback(null, file);
					} catch (error) {
						callback(error);
					}
				},
			});

		await new Promise((resolve, reject) => {
			gulp.src('inheritance.scss', {
				cwd: path.join(__dirname, 'scss'),
				sourcemaps: true,
			})
				.pipe(
					new Transform({
						transform(file, callback) {
							try {
								expect(file.sourceMap).toBeTruthy();
								callback(null, file);
							} catch (error) {
								callback(error);
							}
						},
					}),
				)
				.pipe(sass())
				.pipe(sourcesTransformTest())
				.on('data', () => {})
				.on('error', reject)
				.on('end', resolve);
		});
	});
});

describe('sync compile', () => {
	let stream;

	beforeEach(
		() => (stream = initializeStream({ sync: true, style: 'compressed' })),
	);

	it('passes file when it isNull()', async () => {
		const emptyFile = {
			isNull: () => true,
		};
		const data = await writeFileToStream(stream, emptyFile);
		expect(data).toEqual(emptyFile);
	});

	it('emits error when file isStream()', async () => {
		const streamFile = {
			isStream: () => true,
			isNull: () => false,
		};
		await expect(writeFileToStream(stream, streamFile)).rejects.toThrow(
			'Streams are not supported!',
		);
	});

	it('compiles an empty sass file', async () => {
		const emptyFile = createVinyl('empty.scss', '');
		const data = await writeFileToStream(stream, emptyFile);
		expect(data.contents.toString()).toBe('');
		expect(data.path).toMatch(/\.css$/);
	});

	it('compiles a single sass file', async () => {
		const sassFile = createVinyl('style.scss', 'body { color: red; }');
		const data = await writeFileToStream(stream, sassFile);
		expect(data.contents.toString()).toContain('body{color:red}');
		expect(data.path).toMatch(/\.css$/);
	});

	it('compiles multiple sass files', async () => {
		const files = [
			createVinyl('mixins.scss'),
			createVinyl('variables.scss'),
		];

		const data = await writeFileToStream(stream, files);

		expect(data.length).toBe(files.length);

		for (const cssFile of data) {
			expect(cssFile).toBeTruthy();
			expect(cssFile.path).toBeTruthy();
			expect(cssFile.relative).toBeTruthy();
			expect(cssFile.contents).toBeTruthy();

			const { actual, expected } = getCompiledAndExpected(cssFile);
			expect(actual).toBe(expected);
		}
	});
});
