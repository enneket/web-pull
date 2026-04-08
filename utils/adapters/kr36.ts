import type { SiteAdapter } from '../../types'
import { processLazyImagesForAdapter } from './shared'

export const kr36Adapter: SiteAdapter = {
  name: '36kr',
  match: (url) => url.includes('36kr.com'),
  getContentSelector: () => '.article-content, .common-width',
  getAuthor: () => {
    const authorEl = document.querySelector('.author-name, .article-author a')
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('.article-time, time[datetime]')
    return (
      timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || ''
    )
  },
  getTitle: () => {
    const titleEl = document.querySelector('.article-title, h1.title')
    return titleEl?.textContent?.trim() || document.title
  },
  preProcess: processLazyImagesForAdapter,
}
