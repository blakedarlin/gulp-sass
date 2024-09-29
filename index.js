/* eslint-disable unicorn/no-null */
import replaceExtension from 'replace-ext';
import { Transform } from 'streamx';
import applySourceMap from 'vinyl-sourcemaps-apply';
import {
	initAsyncCompiler,
	initCompiler,
	Compiler,
	AsyncCompiler,
} from 'sass-embedded';
import PluginError from 'plugin-error';

import { pathToFileURL } from 'node:url';

const PLUGIN_NAME = 'gulp-sass-embedded';

/**
 * Constructs the arguments needed to compile a Sass file.
 * @param {Vinyl} file - The Vinyl file object representing the Sass file.
 * @param {object} options - Options to customize Sass compilation.
 * @returns {Array} - An array with the Sass code string and options.
 */
export const createCompileArguments = (file, options = {}) => {
	const {
		path = '',
		extname = '',
		dirname = '',
		contents = '',
		sourceMap = false,
	} = file || {};
	const { loadPaths = [] } = options;
	let fileSyntax;

	switch (extname) {
		case '.sass': {
			fileSyntax = 'indented';
			break;
		}
		case '.css': {
			fileSyntax = 'css';
			break;
		}
		default: {
			fileSyntax = 'scss';
			break;
		}
	}

	return [
		contents.toString(),
		{
			...options,
			url: pathToFileURL(path),
			sourceMap: Boolean(sourceMap),
			sourceMapIncludeSources: Boolean(sourceMap),
			syntax: fileSyntax,
			// Ensure file's parent directory in the include path.
			loadPaths: [
				...new Set(
					[dirname, ...loadPaths].filter(
						(path) => typeof path === 'string' && path.length > 0,
					),
				),
			],
		},
	];
};

export const formatSassError = (error) => {
	if (!error) {
		return new Error('No error message provided');
	}
	if (error?.span?.start) {
		const line = error.span.start.line ?? 0;
		const column = error.span.start.column ?? 0;
		error.line = line + 1;
		error.column = column + 1;
	}
	error.messageOriginal = error.sassMessage ?? error.message;
	error.messageFormatted = error.message;

	return error;
};

/**
 * Transforms Vinyl file streams by compiling Sass to CSS.
 * @param {object} options - Compilation options for the Sass compiler.
 * @returns {Transform} - A stream transform object for Sass compilation.
 */
const gulpSassEmbedded = (options = {}) => {
	let compiler;

	const transform = new Transform({
		async open(callback) {
			try {
				compiler = options?.sync
					? initCompiler()
					: await initAsyncCompiler();
				callback();
			} catch (error) {
				callback(new PluginError(PLUGIN_NAME, error));
			}
		},
		async transform(file, callback) {
			try {
				if (file.isNull()) {
					callback(null, file);
					return;
				}

				if (file.isStream()) {
					callback(
						new PluginError(
							PLUGIN_NAME,
							'Streams are not supported!',
						),
					);
					return;
				}

				// Skip partials.
				if (file.basename.startsWith('_')) {
					callback();
					return;
				}

				if (file.contents.length === 0) {
					file.path = replaceExtension(file.path, '.css');
					callback(null, file);
					return;
				}

				const compileArguments = createCompileArguments(file, options);

				// Use the async/sync compile command.
				const { css, sourceMap } = options?.sync
					? compiler.compileString(...compileArguments)
					: await compiler.compileStringAsync(...compileArguments);

				file.contents = Buffer.from(css);
				file.path = replaceExtension(file.path, '.css');
				if (file.stat) {
					file.stat.atime =
						file.stat.mtime =
						file.stat.ctime =
							new Date();
				}

				if (sourceMap != undefined) {
					sourceMap.file ??= file.path;
					applySourceMap(file, sourceMap);
				}

				callback(null, file);
			} catch (error) {
				callback(
					new PluginError(PLUGIN_NAME, formatSassError(error), {
						showProperties: false,
					}),
				);
			}
		},
		async destroy(callback) {
			// Dispose the compiler when all files have been processed.
			try {
				if (compiler) {
					await compiler.dispose();
				}
				callback();
			} catch (error) {
				// Emit an error event instead of calling the callback with an error
				this.emit(
					'error',
					new PluginError(PLUGIN_NAME, error, {
						showProperties: false,
					}),
				);
				callback();
			}
		},
	});

	transform.isCompilerInitialized = () => {
		return options?.sync
			? compiler instanceof Compiler
			: compiler instanceof AsyncCompiler;
	};

	return transform;
};

// A utility to create a sync instance of the plugin.
gulpSassEmbedded.sync = (options = {}) => {
	return gulpSassEmbedded({ ...options, sync: true });
};

export default gulpSassEmbedded;
