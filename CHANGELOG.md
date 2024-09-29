# Changelog

## 1.0.1

-   Remove logError function.

## 1.0.0

Rewrite of `gulp-sass` to replace the `sass` package with the new, faster `sass-embedded` package, which is a JavaScript wrapper around a native Dart executable.

##### Features

-   Replace `sass` with `sass-embedded`.
-   Use performant `streamx` package to handle the transform.
-   Use [recommended compiler initialization](https://sass-lang.com/documentation/js-api/functions/initcompiler/) method for performance gains.

##### Fixes

-   Add Jest tests.
