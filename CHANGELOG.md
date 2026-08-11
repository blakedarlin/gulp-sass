# Changelog

## 1.1.3

- Update packages.
- Refactor ESLint configuration to use `defineConfig` and `globalIgnores`.
- Enhance tests for Sass error handling and source map validation.

## 1.1.2

- Update packages.
- Refactor ESLint configuration to use unicorn `recommended` preset.

## 1.1.1

- Update packages.

## 1.1.0

- Export sass value types.
- Add test to test value type exports.

## 1.0.2

- Update packages.
- Fix Sass deprecation warnings in tests.

## 1.0.1

- Remove logError function.

## 1.0.0

Rewrite of `gulp-sass` to replace the `sass` package with the new, faster `sass-embedded` package, which is a JavaScript wrapper around a native Dart executable.

### Features

- Replace `sass` with `sass-embedded`.
- Use performant `streamx` package to handle the transform.
- Use [recommended compiler initialization](https://sass-lang.com/documentation/js-api/functions/initcompiler/) method for performance gains.

### Fixes

- Add Jest tests.
