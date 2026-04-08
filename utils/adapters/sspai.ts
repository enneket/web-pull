import type { SiteAdapter } from '../../types'
import { processLazyImagesForAdapter } from './shared'

export const sspaiAdapter: SiteAdapter = {
  name: 'sspai',
  match: (url) => url.includes('sspai.com'),
  getContentSelector: () => '.article-body, .content',
  getAuthor: () => {
    const authorEl = document.querySelector('.nickname, .author-name')
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('time[datetime], .date')
    return (
      timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || ''
    )
  },
  getTitle: () => {
    const titleEl = document.querySelector('.title, h1')
    return titleEl?.textContent?.trim() || document.title
  },
  preProcess: processLazyImagesForAdapter,
}
