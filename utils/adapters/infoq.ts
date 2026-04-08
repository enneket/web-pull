import type { SiteAdapter } from '../../types'

export const infoqAdapter: SiteAdapter = {
  name: 'infoq',
  match: (url) => url.includes('infoq.cn') || url.includes('infoq.com'),
  getContentSelector: () => '.article-content, .article-preview',
  getAuthor: () => {
    const authorEl = document.querySelector('.author-name, .article-author')
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('.date, .article-time')
    return timeEl?.textContent?.trim() || ''
  },
  getTitle: () => {
    const titleEl = document.querySelector(
      '.article-title h1, .article-preview-title',
    )
    return titleEl?.textContent?.trim() || document.title
  },
}
