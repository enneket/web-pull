import { defineConfig } from 'wxt'

export default defineConfig({
  entrypointsDir: 'entrypoints',
  outDir: 'dist',
  manifestVersion: 3,
  manifest: {
    permissions: ['activeTab', 'downloads', 'scripting'],
    content_scripts: [],
    action: {},
    icons: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
  },
})
