/**
 * Webpack Plugin to Completely Block Next.js Devtools Chunks
 * 
 * This plugin prevents Next.js from generating devtools-related chunks
 * that cause runtime errors while preserving React DevTools functionality
 */

class DevtoolsBlockerPlugin {
  constructor() {
    this.pluginName = 'DevtoolsBlockerPlugin';
  }

  apply(compiler) {
    // Block devtools chunks during compilation
    compiler.hooks.compilation.tap(this.pluginName, (compilation) => {
      // Prevent devtools chunks from being created
      compilation.hooks.shouldGenerateChunkAssets.tap(this.pluginName, () => {
        // Filter out devtools chunks from assets
        const assets = compilation.assets;
        const devtoolsPattern = /next-devtools|devtools_index/i;
        
        Object.keys(assets).forEach(assetName => {
          if (devtoolsPattern.test(assetName)) {
            delete assets[assetName];
          }
        });
      });

      // Block devtools modules during optimization
      compilation.hooks.optimizeChunks.tap(this.pluginName, (chunks) => {
        chunks.forEach(chunk => {
          if (chunk.name && chunk.name.includes('devtools')) {
            // Remove devtools chunks entirely
            compilation.chunks.delete(chunk);
          }
        });
      });
    });

    // Block devtools at the resolver level
    compiler.hooks.normalModuleFactory.tap(this.pluginName, (factory) => {
      factory.hooks.beforeResolve.tap(this.pluginName, (resolveData) => {
        if (resolveData.request && resolveData.request.includes('next-devtools')) {
          // Return null to prevent resolution of devtools modules
          return false;
        }
      });
    });

    // Prevent devtools chunks from being emitted
    compiler.hooks.emit.tap(this.pluginName, (compilation) => {
      const devtoolsPattern = /next-devtools|devtools_index/i;
      
      Object.keys(compilation.assets).forEach(filename => {
        if (devtoolsPattern.test(filename)) {
          delete compilation.assets[filename];
        }
      });
    });
  }
}

module.exports = DevtoolsBlockerPlugin;