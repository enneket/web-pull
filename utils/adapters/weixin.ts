import type { SiteAdapter } from '../../types'
import { processLazyImagesForAdapter } from './shared'

export const weixinAdapter: SiteAdapter = {
  name: 'weixin',
  match: (url) => url.includes('mp.weixin.qq.com'),
  getContentSelector: () => '#js_content',
  getAuthor: () => {
    const accountName = document.getElementById('js_name')?.textContent?.trim()
    const author = document
      .getElementById('js_author_name')
      ?.textContent?.trim()
    return author || accountName || ''
  },
  getPublishedAt: () => {
    const publishTime = document
      .getElementById('publish_time')
      ?.textContent?.trim()
    if (publishTime) return publishTime

    const scripts = document.querySelectorAll('script')
    for (const script of scripts) {
      const match = script.textContent?.match(/var\s+ct\s*=\s*"(\d+)"/)
      if (match) {
        return new Date(parseInt(match[1]) * 1000).toISOString()
      }
    }
    return ''
  },
  getTitle: () => {
    return (
      document.getElementById('activity-name')?.textContent?.trim() ||
      document.title
    )
  },
  preProcess: processLazyImagesForAdapter,
}
