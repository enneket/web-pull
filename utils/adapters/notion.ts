import type { SiteAdapter } from '../../types'
import { processLazyImagesForAdapter } from './shared'

export const notionAdapter: SiteAdapter = {
  name: 'notion',
  match: (url) => url.includes('notion.site') || url.includes('notion.so'),
  getContentSelector: () =>
    '.notion-page-content, [class*="notion-page-content"]',
  getAuthor: () => '',
  getPublishedAt: () => '',
  getTitle: () => {
    const titleEl = document.querySelector(
      '.notion-page-block h1, [class*="notion-header-block"]',
    )
    return titleEl?.textContent?.trim() || document.title
  },
  preProcess: processLazyImagesForAdapter,
}
