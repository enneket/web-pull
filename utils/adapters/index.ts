import type { SiteAdapter } from '../../types'
import { weixinAdapter } from './weixin'
import { zhihuAdapter } from './zhihu'
import { mediumAdapter } from './medium'
import { juejinAdapter } from './juejin'
import { csdnAdapter } from './csdn'
import { infoqAdapter } from './infoq'
import { kr36Adapter } from './kr36'
import { sspaiAdapter } from './sspai'
import { segmentfaultAdapter } from './segmentfault'
import { cnblogsAdapter } from './cnblogs'
import { jianshuAdapter } from './jianshu'
import { oschinaAdapter } from './oschina'
import { huxiuAdapter } from './huxiu'
import { geekparkAdapter } from './geekpark'
import { substackAdapter } from './substack'
import { devtoAdapter } from './devto'
import { hashnodeAdapter } from './hashnode'
import { notionAdapter } from './notion'
import { twitterAdapter } from './twitter'

const adapters: SiteAdapter[] = [
  weixinAdapter,
  zhihuAdapter,
  mediumAdapter,
  juejinAdapter,
  csdnAdapter,
  infoqAdapter,
  kr36Adapter,
  sspaiAdapter,
  segmentfaultAdapter,
  cnblogsAdapter,
  jianshuAdapter,
  oschinaAdapter,
  huxiuAdapter,
  geekparkAdapter,
  substackAdapter,
  devtoAdapter,
  hashnodeAdapter,
  notionAdapter,
  twitterAdapter,
]

export function getSiteAdapter(url: string): SiteAdapter | null {
  for (const adapter of adapters) {
    if (adapter.match(url)) {
      return adapter
    }
  }
  return null
}

export function extractWithAdapter(adapter: SiteAdapter): {
  title: string
  author: string
  publishedAt: string
  contentHtml: string
} {
  if (adapter.preProcess) {
    adapter.preProcess()
  }

  const contentSelector = adapter.getContentSelector()
  const contentEl = document.querySelector(contentSelector)

  let contentHtml = ''
  if (contentEl) {
    const clone = contentEl.cloneNode(true) as Element
    const removeSelectors = [
      'script',
      'style',
      'noscript',
      '.comment',
      '.comments',
      '.share',
      '.social',
      '.recommend',
      '.related',
      '.ad',
      '.ads',
    ]
    removeSelectors.forEach((selector) => {
      clone.querySelectorAll(selector).forEach((el) => {
        el.remove()
      })
    })
    contentHtml = clone.innerHTML
  }

  return {
    title: adapter.getTitle(),
    author: adapter.getAuthor(),
    publishedAt: adapter.getPublishedAt(),
    contentHtml,
  }
}

export type { SiteAdapter }
