import type { SiteAdapter } from '../../types'

export const cnblogsAdapter: SiteAdapter = {
  name: 'cnblogs',
  match: (url) => url.includes('cnblogs.com'),
  getContentSelector: () => '#cnblogs_post_body, .post-body',
  getAuthor: () => {
    const authorEl = document.querySelector('#Header1_HeaderTitle, .author a')
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('#post-date, .postDesc span')
    return timeEl?.textContent?.trim() || ''
  },
  getTitle: () => {
    const titleEl = document.querySelector('#cb_post_title_url, .postTitle a')
    return titleEl?.textContent?.trim() || document.title
  },
}
