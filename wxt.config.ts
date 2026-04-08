import { defineConfig } from 'wxt'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  entrypointsDir: 'entrypoints',
  outDir: 'dist',
  manifestVersion: 3,
  manifest: {
    permissions: ['activeTab', 'downloads', 'scripting'],
    content_scripts: [],
  },
  vite: () => ({
    plugins: [vue()],
  }),
})
