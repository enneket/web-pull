import type { SiteAdapter } from '../../types'

export const juejinAdapter: SiteAdapter = {
  name: 'juejin',
  match: (url) => url.includes('juejin.cn'),
  getContentSelector: () => '.article-content, .markdown-body',
  getAuthor: () => {
    const authorEl = document.querySelector('.author-name a, .username')
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('.meta-box time, .article-meta time')
    return (
      timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || ''
    )
  },
  getTitle: () => {
    const titleEl = document.querySelector('.article-title')
    return titleEl?.textContent?.trim() || document.title
  },
}
