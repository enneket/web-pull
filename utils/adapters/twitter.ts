import type { SiteAdapter } from '../../types'
import { processLazyImagesForAdapter } from './shared'

export const twitterAdapter: SiteAdapter = {
  name: 'twitter',
  match: (url) => url.includes('twitter.com') || url.includes('x.com'),
  getContentSelector: () => {
    const isArticleMode = window.location.pathname.includes('/article/')
    if (isArticleMode) {
      return 'main > div > div'
    }
    const hasArticleContent = document.querySelector(
      'main h2, main [role="heading"][aria-level="2"]',
    )
    if (hasArticleContent) {
      return 'main article, main > div > div'
    }
    return '[data-testid="tweetText"]'
  },
  getAuthor: () => {
    const isArticleMode = window.location.pathname.includes('/article/')

    if (isArticleMode) {
      const authorLink = document.querySelector(
        'main a[href^="/"][href$="' +
          window.location.pathname.split('/')[1] +
          '"]',
      )
      if (authorLink) {
        const nameSpan = authorLink.querySelector('span:not(:empty)')
        if (nameSpan) {
          const text = nameSpan.textContent?.trim()
          if (text && !text.startsWith('@') && !text.includes('认证')) {
            return text
          }
        }
      }
    }

    const pathMatch = window.location.pathname.match(/^\/([^/]+)/)
    if (pathMatch) {
      const username = pathMatch[1]
      const userLink = document.querySelector(`main a[href="/${username}"]`)
      if (userLink) {
        const spans = userLink.querySelectorAll('span')
        for (const span of spans) {
          const text = span.textContent?.trim()
          if (
            text &&
            !text.startsWith('@') &&
            !text.includes('·') &&
            text.length > 0 &&
            text.length < 50
          ) {
            return text
          }
        }
      }
    }

    const metaAuthor = document.querySelector('meta[property="og:title"]')
    if (metaAuthor) {
      const content = metaAuthor.getAttribute('content') || ''
      const match = content.match(/^(.+?)\s+on\s+(?:X|Twitter)/i)
      if (match) return match[1]
      const quoteMatch = content.match(/^(.+?)[:：]?\s*[""「]/)
      if (quoteMatch) return quoteMatch[1]
    }
    return ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('main time[datetime]')
    return timeEl?.getAttribute('datetime') || ''
  },
  getTitle: () => {
    const isArticleMode = window.location.pathname.includes('/article/')
    if (isArticleMode) {
      const mainContent = document.querySelector('main > div > div > div')
      if (mainContent) {
        const children = mainContent.children
        for (let i = 0; i < Math.min(children.length, 5); i++) {
          const el = children[i]
          const text = el.textContent?.trim()
          if (
            text &&
            text.length > 10 &&
            text.length < 200 &&
            !text.includes('@') &&
            !el.querySelector('img')
          ) {
            return text
          }
        }
      }
    }
    const h2 = document.querySelector(
      'main h2, main [role="heading"][aria-level="2"]',
    )
    if (h2) {
      return h2.textContent?.trim() || ''
    }
    const metaTitle = document.querySelector('meta[property="og:title"]')
    if (metaTitle) {
      const content = metaTitle.getAttribute('content') || ''
      return content
        .replace(/\s+on\s+(?:X|Twitter).*$/i, '')
        .replace(/\s*[/／]\s*X$/, '')
        .trim()
    }
    return document.title
  },
  preProcess: () => {
    processLazyImagesForAdapter()

    const removeSelectors = [
      '[data-testid="placementTracking"]',
      '[role="group"]',
      'button',
      '[data-testid="app-bar"]',
      'nav',
    ]

    const mainEl = document.querySelector('main')
    if (mainEl) {
      const clone = mainEl.cloneNode(true) as Element
      removeSelectors.forEach((sel) => {
        clone.querySelectorAll(sel).forEach((el) => {
          if (!el.closest('article') || sel === '[role="group"]') {
            el.remove()
          }
        })
      })
    }

    document.querySelectorAll('main article').forEach((quotedTweet) => {
      const authorSpan = quotedTweet.querySelector('a[href^="/"] span')
      const textEl = quotedTweet.querySelector(
        'div[lang], [data-testid="tweetText"]',
      )
      const authorName = authorSpan?.textContent?.trim() || ''
      const tweetText = textEl?.innerHTML || ''

      if (authorName && tweetText) {
        const blockquote = document.createElement('blockquote')
        blockquote.className = 'x-embedded-tweet'
        blockquote.innerHTML = `<p><strong>${authorName}</strong></p><div>${tweetText}</div>`
        quotedTweet.parentNode?.replaceChild(blockquote, quotedTweet)
      }
    })
  },
}
