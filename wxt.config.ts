import { defineConfig } from 'wxt'

export default defineConfig({
  entrypointsDir: 'entrypoints',
  outDir: 'dist',
  manifestVersion: 3,
  manifest: {
    name: 'WebPull - 一键采集页面为 Markdown',
    description: '支持 CSDN、知乎、掘金等平台的 Markdown 一键采集，自动提取代码块、公式、Mermaid 图表和图片',
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
