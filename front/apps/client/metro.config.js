const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

// Use fs.realpathSync.native to guarantee exact Windows file system casing (REDGO vs RedGo)
const projectRoot = fs.realpathSync.native(__dirname);
const monorepoRoot = fs.realpathSync.native(path.resolve(projectRoot, '../..'));

const config = getDefaultConfig(projectRoot);

// Collect all roots including original __dirname and case variants
const watchRoots = new Set([
  ...(config.watchFolders || []),
  projectRoot,
  monorepoRoot,
  __dirname,
  path.resolve(__dirname, '../..'),
]);

for (const folder of Array.from(watchRoots)) {
  watchRoots.add(folder.replace(/\\RedGo/gi, '\\REDGO'));
  watchRoots.add(folder.replace(/\\RedGo/gi, '\\RedGo'));
}

config.watchFolders = Array.from(watchRoots).filter((p) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
});

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
  path.resolve(__dirname, 'node_modules'),
  path.resolve(path.resolve(__dirname, '../..'), 'node_modules'),
];

module.exports = config;
