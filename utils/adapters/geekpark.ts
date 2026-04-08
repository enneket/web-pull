import type { SiteAdapter } from '../../types'

export const geekparkAdapter: SiteAdapter = {
  name: 'geekpark',
  match: (url) => url.includes('geekpark.net'),
  getContentSelector: () => '.article-content, .post-content',
  getAuthor: () => {
    const authorEl = document.querySelector('.author-name, .article-author')
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('.publish-time, time')
    return timeEl?.textContent?.trim() || ''
  },
  getTitle: () => {
    const titleEl = document.querySelector('.article-title, h1')
    return titleEl?.textContent?.trim() || document.title
  },
}
