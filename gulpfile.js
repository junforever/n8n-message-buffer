const { src, dest, task } = require('gulp');

function buildIcons() {
  return src('nodes/**/*.svg').pipe(dest('dist/nodes/'));
}

task('build:icons', buildIcons);
task('default', task('build:icons'));

module.exports = {
  'build:icons': buildIcons,
};
