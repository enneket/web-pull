import type { SiteAdapter } from '../../types'

export const zhihuAdapter: SiteAdapter = {
  name: 'zhihu',
  match: (url) => url.includes('zhihu.com'),
  getContentSelector: () => {
    if (window.location.pathname.includes('/p/')) {
      return '.Post-RichText'
    }
    if (window.location.pathname.includes('/answer/')) {
      return '.AnswerItem .RichContent-inner'
    }
    return '.RichText'
  },
  getAuthor: () => {
    const authorLink = document.querySelector(
      '.AuthorInfo-name a, .UserLink-link',
    )
    return authorLink?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('.ContentItem-time')
    const timeText = timeEl?.textContent?.trim() || ''
    const match = timeText.match(/(\d{4}-\d{2}-\d{2})/)
    return match ? match[1] : ''
  },
  getTitle: () => {
    const postTitle = document.querySelector('.Post-Title')
    if (postTitle) return postTitle.textContent?.trim() || ''

    const questionTitle = document.querySelector('.QuestionHeader-title')
    return questionTitle?.textContent?.trim() || document.title
  },
}
