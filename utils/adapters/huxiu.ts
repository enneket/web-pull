import type { SiteAdapter } from '../../types'
import { processLazyImagesForAdapter } from './shared'

export const huxiuAdapter: SiteAdapter = {
  name: 'huxiu',
  match: (url) => url.includes('huxiu.com'),
  getContentSelector: () => '.article-content, .article__content',
  getAuthor: () => {
    const authorEl = document.querySelector('.author-name, .article-author')
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('.article-time, time')
    return timeEl?.textContent?.trim() || ''
  },
  getTitle: () => {
    const titleEl = document.querySelector('.article-title, h1')
    return titleEl?.textContent?.trim() || document.title
  },
  preProcess: processLazyImagesForAdapter,
}
