const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Let Metro find packages hoisted to the workspace root node_modules.
// Watch only the hoisted node_modules rather than the whole workspace, so
// server-side code (backend/) can never be pulled into a client bundle.
config.watchFolders = [path.resolve(workspaceRoot, 'node_modules')];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Belt and braces: refuse to resolve anything under backend/ from the app.
config.resolver.blockList = [
  new RegExp(`^${path.resolve(workspaceRoot, 'backend').replace(/[\\/]/g, '[\\\\/]')}[\\\\/].*`),
];

// zustand 4.x ships two builds: a CommonJS one (its "react-native" and
// "default" export conditions) and an ESM one that uses Vite-style
// `import.meta.env.MODE` for its dev warnings. On web, Metro matches the
// "import"/"module" condition and pulls in the ESM build; because the web
// bundle is served as a classic script, `import.meta` is a hard SyntaxError
// and nothing renders. Resolve zustand through the CommonJS conditions only.
// Scoped to zustand so resolution for every other package is untouched.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;

  if (moduleName === 'zustand' || moduleName.startsWith('zustand/')) {
    return resolve(
      { ...context, unstable_conditionNames: ['react-native', 'require', 'default'] },
      moduleName,
      platform
    );
  }

  return resolve(context, moduleName, platform);
};

module.exports = config;
