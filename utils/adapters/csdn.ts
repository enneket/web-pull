import type { SiteAdapter } from '../../types'

export const csdnAdapter: SiteAdapter = {
  name: 'csdn',
  match: (url) => url.includes('blog.csdn.net'),
  getContentSelector: () => '#content_views, .article_content',
  getAuthor: () => {
    const authorEl = document.querySelector(
      '.follow-nickName, .profile-intro-name-boxTop a',
    )
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('.time')
    return timeEl?.textContent?.trim() || ''
  },
  getTitle: () => {
    const titleEl = document.querySelector('.title-article')
    return titleEl?.textContent?.trim() || document.title
  },
}
