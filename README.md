# gulp-sass

Gulp plugin for the [sass-embedded](https://github.com/sass/embedded-host-node) package. Compiles files with `sass-embedded`, without the need for an external compiler. Performance is about 3x better than the original `gulp-sass` using the Dart Sass compiler, since the instance can persist between compilations:

> When calling the compile functions multiple times, using a compiler instance with the sass-embedded npm package is much faster than using the top-level compilation methods or the sass npm package.

[Source: Sass Documentation](https://sass-lang.com/documentation/js-api/functions/initcompiler/)

## Installation

```sh
npm install @blakedarlin/gulp-sass --save-dev
```

## Usage

```javascript
const gulp = require('gulp');
const sass = require('@blakedarlin/gulp-sass');

function buildStyles() {
	return gulp.src('./sass/**/*.scss').pipe(sass()).pipe(gulp.dest('./css'));
}

exports.buildStyles = buildStyles;
exports.watch = function () {
	gulp.watch('./sass/**/*.scss', ['buildStyles']);
};
```

### Using `pipeline()` and ES6

The following example uses Node's stream pipeline, as well as Gulp's built-in [sourcemaps](https://gulpjs.com/docs/en/api/dest/#sourcemaps) support.

```javascript
import gulp from 'gulp';
import sass from 'gulp-sass';
import { pipeline } from 'node:stream/promises';

export const buildStyles = async (callback) =>
	await pipeline(
		gulp.src('./sass/**/*.scss', {
			allowEmpty: true,
			sourcemaps: true,
		}),
		sass(),
		gulp.dest('./css', {
			sourcemaps: true,
		}),
	).catch((error) => callback(error));

const watch = gulp.watch('./sass/**/*.scss', { delay: 500 }, buildStyles);
export default watch;
```

For synchronous compiling, use:

```javascript
		sass.sync(),
```

### Passing options to Sass

```javascript
loadPaths?: string[]
importers?: (NodePackageImporter | Importer<sync> | FileImporter<sync>)[]
functions?: Record<string, CustomFunction<sync>>
```

Passing options to the Gulp Sass plugin will pass them in turn to the Sass compiler. Refer to the [Sass compiler options](https://sass-lang.com/documentation/js-api/interfaces/options/) for more information. To cover a few in this context:

#### [loadPaths](https://sass-lang.com/documentation/js-api/interfaces/options/#loadPaths)

The compiler accepts a `loadPaths` option, which is a string array of absolute paths. Each file's own parent is automatically added as its first `loadPaths` item, so there is no need to specify it.

```javascript
sass({
	loadPaths: ['/some/absolute/path', '/some/other/absolute/path'],
});
```

#### [importers](https://sass-lang.com/documentation/js-api/interfaces/options/#importers)

Custom importers that control how Sass resolves loads from rules like @use and @import. For example, sass-json-importer allows importing JSON records as Sass variables.

```javascript
import jsonImporter from 'sass-json-importer';

	...
		sass({
			importers: [ jsonImporter() ],
		})
	...
```

#### [functions](https://sass-lang.com/documentation/js-api/interfaces/options/#functions)

Define additional built-in Sass functions that are available in all stylesheets. This option takes an object whose keys are Sass function signatures like you'd write for the `@function` rule. No longer is it necessary to use slow collections of Sass @functions or @mixins for basic functionality, such as `string.replace`.

Import and provide your custom function to the Gulp Sass options.

```javascript
// gulpfile.js
import svgInline from './svg-inline.js';
	...
		sass({
			functions: {
				'svg-inline($filePath, $fill: null, $stroke: null)': svgInline,
			}
		})
	...
```

The JavaScript function itself will use Sass's own variable types. Note that any file path will not be resolved using the `loadPaths` option passed to the Sass compiler. Your custom function will need to handle that resolution.

```javascript
// svg-inline.js
import { SassString, sassNull } from 'sass-embedded';

const svgInline = (arguments_) => {
	const filePath = arguments_[0].assertString('path').text;
	const fill = arguments_[1] ?? sassNull;
	const stroke = arguments_[2] ?? sassNull;

	if (filePath && !filePath.toLowerCase().endsWith('.svg')) {
		throw new Error(
			'Invalid SVG file path provided. Ensure the file path ends with .svg extension.',
		);
	}
	// ... import and process the SVG file ...
	return new SassString(
		`url("data:image/svg+xml;charset=utf-8,${encodedSvgContent}")`,
		{ quotes: false },
	);
};
export default svgInline;
```

```scss
@use 'abstracts/form-image' as image;

// Use Sass variables to recolor the fill and stroke. (These can't be CSS custom properties, though.)
.button > i {
	background-image: svg-inline(
		'feather-icons/dist/icons/arrow-right.svg',
		$stroke: $icon-hover-color
	);
}

// When using a custom function for the value of a CSS custom property, wrap it in #{...}.
.accordion {
	--icon: #{svg-inline('feather-icons/dist/icons/plus.svg')};
	--close-icon: #{svg-inline('feather-icons/dist/icons/minus.svg')};
}

// Using a namespaced Sass variable.
[type='checkbox']:checked {
	mask-image: svg-inline(image.$checkbox-image__checked);
}
```
