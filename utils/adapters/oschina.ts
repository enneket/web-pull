import type { SiteAdapter } from '../../types'

export const oschinaAdapter: SiteAdapter = {
  name: 'oschina',
  match: (url) => url.includes('oschina.net'),
  getContentSelector: () => '.article-detail, .content',
  getAuthor: () => {
    const authorEl = document.querySelector('.author-name, .user-info .name')
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('.publish-time, time')
    return (
      timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || ''
    )
  },
  getTitle: () => {
    const titleEl = document.querySelector('.article-box__title, h1')
    return titleEl?.textContent?.trim() || document.title
  },
}
