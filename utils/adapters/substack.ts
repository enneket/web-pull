import type { SiteAdapter } from '../../types'

export const substackAdapter: SiteAdapter = {
  name: 'substack',
  match: (url) =>
    url.includes('substack.com') ||
    document.querySelector(
      'meta[property="og:site_name"][content*="Substack"]',
    ) !== null,
  getContentSelector: () => '.body, .post-content, article',
  getAuthor: () => {
    const authorMeta = document.querySelector('meta[name="author"]')
    if (authorMeta) return authorMeta.getAttribute('content') || ''
    const authorEl = document.querySelector('.author-name, .byline-names')
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeMeta = document.querySelector(
      'meta[property="article:published_time"]',
    )
    if (timeMeta) return timeMeta.getAttribute('content') || ''
    const timeEl = document.querySelector('time[datetime]')
    return timeEl?.getAttribute('datetime') || ''
  },
  getTitle: () => {
    const titleEl = document.querySelector('h1.post-title, h1')
    return titleEl?.textContent?.trim() || document.title
  },
}
