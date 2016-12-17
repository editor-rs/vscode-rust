var gulp = require('gulp');
var tslint = require('gulp-tslint');
var shell = require('gulp-shell');

var files = {
    src: 'src/**/*.ts',
    test: 'test/**/*.ts'
};

gulp.task('compile', shell.task([
    'tsc -p .'
]));

gulp.task('tslint', function() {
    return gulp.src([files.src, files.test, '!test/index.ts'])
        .pipe(tslint())
        .pipe(tslint.report('verbose'));
});

gulp.task('default', ['compile', 'tslint']);
