import type { SiteAdapter } from '../../types'
import { processLazyImagesForAdapter } from './shared'

export const jianshuAdapter: SiteAdapter = {
  name: 'jianshu',
  match: (url) => url.includes('jianshu.com'),
  getContentSelector: () => 'article, .article',
  getAuthor: () => {
    const authorEl = document.querySelector('.name, ._22gUMi')
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('time, .publish-time')
    return (
      timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || ''
    )
  },
  getTitle: () => {
    const titleEl = document.querySelector('h1, ._1RuRku')
    return titleEl?.textContent?.trim() || document.title
  },
  preProcess: processLazyImagesForAdapter,
}
