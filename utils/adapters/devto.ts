import type { SiteAdapter } from '../../types'

export const devtoAdapter: SiteAdapter = {
  name: 'devto',
  match: (url) => url.includes('dev.to'),
  getContentSelector: () => '#article-body, .crayons-article__body',
  getAuthor: () => {
    const authorEl = document.querySelector(
      '.crayons-article__subheader a, .author-name',
    )
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('time[datetime]')
    return timeEl?.getAttribute('datetime') || ''
  },
  getTitle: () => {
    const titleEl = document.querySelector('#main-title, h1')
    return titleEl?.textContent?.trim() || document.title
  },
}
