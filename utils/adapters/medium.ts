import type { SiteAdapter } from '../../types'

export const mediumAdapter: SiteAdapter = {
  name: 'medium',
  match: (url) =>
    url.includes('medium.com') ||
    document.querySelector(
      'meta[property="al:android:app_name"][content="Medium"]',
    ) !== null,
  getContentSelector: () => 'article',
  getAuthor: () => {
    const authorMeta = document.querySelector('meta[name="author"]')
    if (authorMeta) return authorMeta.getAttribute('content') || ''

    const authorLink = document.querySelector('a[rel="author"]')
    return authorLink?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeMeta = document.querySelector(
      'meta[property="article:published_time"]',
    )
    if (timeMeta) return timeMeta.getAttribute('content') || ''

    const timeEl = document.querySelector('time')
    return timeEl?.getAttribute('datetime') || ''
  },
  getTitle: () => {
    const h1 = document.querySelector('article h1')
    return h1?.textContent?.trim() || document.title
  },
}
