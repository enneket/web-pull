import { defineConfig } from 'wxt'

export default defineConfig({
  entrypointsDir: 'entrypoints',
  outDir: 'dist',
  manifestVersion: 3,
  manifest: {
    permissions: ['activeTab', 'downloads', 'scripting'],
    content_scripts: [],
    action: {},
  },
})
