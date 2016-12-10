require('babel-register');

var gulp = require("gulp");
var eslint = require("gulp-eslint");
var gulpShell = require("gulp-shell");

// Registers build tasks
require("./build/gulp-clean");
require("./build/gulp-build");
require("./build/gulp-test");
require("./build/gulp-perf");

var srcDir = "lib";

gulp.task("lint", function() {
    return gulp.src(["*.js", srcDir + "/**/*.js"]).
        pipe(eslint()).
        pipe(eslint.format()).
        pipe(eslint.failAfterError()); // dz: change back after finishing to failAfterError
});

gulp.task("doc", ["clean.doc", "doc-d"]);

gulp.task("doc-d", gulpShell.task([
    "./node_modules/.bin/jsdoc lib -r -d doc -c ./build/jsdoc.json --verbose"
]));

// Run in serial to fail build if lint fails.
gulp.task("default", ["build-with-lint", "lint"]);
