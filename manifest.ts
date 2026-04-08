import { defineManifest } from '@wxt-modules/manifest'

export default defineManifest({
  name: 'page-to-md',
  description: 'Extract article and download as Markdown',
  version: '1.0.0',
  permissions: ['activeTab', 'downloads'],
  action: {
    default_popup: 'popup/index.html',
    default_icon: {
      16: '/icons/icon16.png',
      48: '/icons/icon48.png',
      128: '/icons/icon128.png',
    },
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['content/extraction.ts'],
      run_at: 'document_idle',
    },
  ],
  icons: {
    16: '/icons/icon16.png',
    48: '/icons/icon48.png',
    128: '/icons/icon128.png',
  },
})
