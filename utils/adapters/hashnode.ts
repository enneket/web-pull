import type { SiteAdapter } from '../../types'

export const hashnodeAdapter: SiteAdapter = {
  name: 'hashnode',
  match: (url) => url.includes('hashnode.dev') || url.includes('hashnode.com'),
  getContentSelector: () => '.prose, article',
  getAuthor: () => {
    const authorEl = document.querySelector(
      '.author-name, [data-testid="author-name"]',
    )
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('time[datetime]')
    return timeEl?.getAttribute('datetime') || ''
  },
  getTitle: () => {
    const titleEl = document.querySelector('h1')
    return titleEl?.textContent?.trim() || document.title
  },
}
