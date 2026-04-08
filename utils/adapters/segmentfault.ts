import type { SiteAdapter } from '../../types'

export const segmentfaultAdapter: SiteAdapter = {
  name: 'segmentfault',
  match: (url) => url.includes('segmentfault.com'),
  getContentSelector: () => '.article-content, .fmt',
  getAuthor: () => {
    const authorEl = document.querySelector('.author .name, .user-name')
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('time[datetime], .article-time')
    return (
      timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || ''
    )
  },
  getTitle: () => {
    const titleEl = document.querySelector('.article__title, h1.title')
    return titleEl?.textContent?.trim() || document.title
  },
}
