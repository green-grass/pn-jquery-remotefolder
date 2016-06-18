var gulp = require("gulp"),
    rimraf = require("rimraf");

var paths = {
    src: "./src/**/*.*",
    dist: "./dist"
};

gulp.task("clean", function (cb) {
    rimraf(paths.dist, cb);
});

gulp.task("dist", function () {
    gulp.src(paths.src)
        .pipe(gulp.dest(paths.dist));
});

gulp.task("default", ["dist"]);
