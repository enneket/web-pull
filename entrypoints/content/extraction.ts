import { Readability } from '@mozilla/readability'
import type { ExtractedContent, JsonLdArticle } from '../../types'
import { processLazyImages } from '../../utils/lazyImages'
import { htmlToMarkdown } from '../../utils/markdown'
import { getSiteAdapter, extractWithAdapter } from '../../utils/adapters'
import { assessContentQuality } from '../../utils/quality'

let cachedResult: { url: string; data: ExtractedContent } | null = null

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'EXTRACT_ARTICLE') {
        const forceRefresh = message.forceRefresh === true
        extractArticle(forceRefresh)
          .then((result) => sendResponse(result))
          .catch((error) => {
            console.error('Extraction failed:', error)
            sendResponse({
              title: '',
              content_html: '',
              content_md: '',
              source_url: window.location.href,
              top_image: null,
              author: '',
              published_at: '',
              source_domain: new URL(window.location.href).hostname,
            })
          })
      }
      return true
    })
  },
})

interface ExtractedArticle {
  title: string
  content_html: string
  content_md: string
  source_url: string
  top_image: string | null
  author: string
  published_at: string
  source_domain: string
  quality?: { score: number; warnings: string[] }
}

function getTodayDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function extractJsonLd(): Partial<{
  title: string
  author: string
  publishedAt: string
  topImage: string
  description: string
}> {
  const scripts = document.querySelectorAll(
    'script[type="application/ld+json"]',
  )

  for (const script of scripts) {
    try {
      const rawData = JSON.parse(script.textContent || '')
      const dataArray = Array.isArray(rawData) ? rawData : [rawData]

      for (const data of dataArray) {
        const article = findArticleInJsonLd(data)
        if (article) {
          const authorValue = article.author
          let authorName = ''
          if (typeof authorValue === 'string') {
            authorName = authorValue
          } else if (
            authorValue &&
            typeof authorValue === 'object' &&
            authorValue.name
          ) {
            authorName = authorValue.name
          }

          const imageValue = article.image
          let imageUrl = ''
          if (typeof imageValue === 'string') {
            imageUrl = imageValue
          } else if (
            imageValue &&
            typeof imageValue === 'object' &&
            imageValue.url
          ) {
            imageUrl = imageValue.url
          }

          return {
            title: article.headline || article.name || '',
            author: authorName,
            publishedAt: article.datePublished || '',
            topImage: imageUrl,
            description: article.description || '',
          }
        }
      }
    } catch {}
  }
  return {}
}

function findArticleInJsonLd(
  data: JsonLdArticle | { '@graph'?: JsonLdArticle[] },
): JsonLdArticle | null {
  const articleTypes = [
    'Article',
    'NewsArticle',
    'BlogPosting',
    'TechArticle',
    'ScholarlyArticle',
  ]

  if (data['@type'] && articleTypes.includes(data['@type'])) {
    return data as JsonLdArticle
  }

  if ('@graph' in data && Array.isArray(data['@graph'])) {
    for (const item of data['@graph']) {
      if (item['@type'] && articleTypes.includes(item['@type'])) {
        return item
      }
    }
  }

  return null
}

interface Metadata {
  title: string
  author: string
  publishedAt: string
  topImage: string | null
  description: string
}

function extractMetadata(): Metadata {
  const getMeta = (selectors: string[]): string => {
    for (const selector of selectors) {
      const el = document.querySelector(selector)
      if (el instanceof HTMLMetaElement && el.content) {
        return el.content
      }
      if (el instanceof HTMLTimeElement && el.dateTime) {
        return el.dateTime
      }
      if (el?.textContent?.trim()) {
        return el.textContent.trim()
      }
    }
    return ''
  }

  return {
    title: getMeta(['meta[property="og:title"]', 'meta[name="twitter:title"]']),
    author: getMeta([
      'meta[name="author"]',
      'meta[property="article:author"]',
      'meta[name="twitter:creator"]',
      'meta[name="byl"]',
      'meta[name="sailthru.author"]',
      '[itemprop="author"]',
      '[rel="author"]',
      '.author',
      '.byline',
      '.post-author',
      '.entry-author',
    ]),
    publishedAt: getMeta([
      'meta[property="article:published_time"]',
      'meta[name="article:published_time"]',
      'meta[name="published_time"]',
      'meta[property="article:published"]',
      'meta[name="date"]',
      'meta[name="DC.date.issued"]',
      'meta[property="og:published_time"]',
      'time[datetime]',
      '[itemprop="datePublished"]',
    ]),
    topImage:
      getMeta([
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
        'meta[name="twitter:image:src"]',
      ]) || null,
    description: getMeta([
      'meta[property="og:description"]',
      'meta[name="description"]',
      'meta[name="twitter:description"]',
    ]),
  }
}

function extractFallbackContent(): string {
  const selectorsToTry = [
    'article',
    '[role="article"]',
    '[role="main"]',
    'main',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    '#content',
    '.post',
    '.article',
  ]

  let articleElement: Element | null = null
  for (const selector of selectorsToTry) {
    const el = document.querySelector(selector)
    if (el && el.textContent && el.textContent.trim().length > 200) {
      articleElement = el
      break
    }
  }

  if (!articleElement) {
    articleElement = document.body
  }

  const clone = articleElement.cloneNode(true) as Element
  const removeSelectors = [
    'script',
    'style',
    'noscript',
    'iframe',
    'svg',
    'nav',
    'header',
    'footer',
    'aside',
    '.nav',
    '.navigation',
    '.menu',
    '.sidebar',
    '.widget',
    '.ads',
    '.ad',
    '.advertisement',
    '.advert',
    '.comments',
    '.comment',
    '#comments',
    '.comment-section',
    '.share',
    '.social',
    '.social-share',
    '.related',
    '.related-posts',
    '.recommended',
    '.newsletter',
    '.subscribe',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="complementary"]',
    '.paywall',
    '.subscription-wall',
    '.premium-content',
    '.cookie-banner',
    '.cookie-notice',
    '.gdpr',
    '.consent',
    '.popup',
    '.modal',
    '.overlay',
    '.sticky-header',
    '.fixed-header',
    '.floating-header',
    '.breadcrumb',
    '.breadcrumbs',
    '.pagination',
    '.pager',
    '[data-ad]',
    '[data-advertisement]',
    '.sponsored',
    '.promotion',
    '.promo',
    '.print-only',
    '.author-bio',
    '.author-card',
    '.author-box',
    '.table-of-contents',
    '.toc',
    '.feedback',
    '.rating',
    '.reactions',
  ]

  removeSelectors.forEach((selector) => {
    clone.querySelectorAll(selector).forEach((el) => {
      el.remove()
    })
  })

  return clone.innerHTML
}

function resolveRelativeUrls(html: string, baseUrl: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const base = new URL(baseUrl)

  doc.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src')
    if (src && !src.startsWith('data:') && !src.startsWith('http')) {
      try {
        img.setAttribute('src', new URL(src, base).href)
      } catch {
        // Invalid URL, keep original
      }
    }
  })

  doc.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href')
    if (
      href &&
      !href.startsWith('#') &&
      !href.startsWith('javascript:') &&
      !href.startsWith('http')
    ) {
      try {
        a.setAttribute('href', new URL(href, base).href)
      } catch {
        // Invalid URL, keep original
      }
    }
  })

  return doc.body.innerHTML
}

function extractFirstImage(html: string): string | null {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const img = doc.querySelector('img[src]')
  return img?.getAttribute('src') || null
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null

  const isoDate = new Date(dateStr)
  if (!isNaN(isoDate.getTime())) {
    return isoDate.toISOString().split('T')[0]
  }

  const cnMatch = dateStr.match(/(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})/)
  if (cnMatch) {
    const [, year, month, day] = cnMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  return null
}

async function extractArticle(
  forceRefresh = false,
): Promise<ExtractedArticle> {
  const currentUrl = window.location.href

  if (!forceRefresh && cachedResult && cachedResult.url === currentUrl) {
    return cachedResult.data
  }

  processLazyImages()

  const baseUrl = window.location.href
  const jsonLdData = extractJsonLd()
  const meta = extractMetadata()
  const mergedMeta = {
    title: jsonLdData.title || meta.title,
    author: jsonLdData.author || meta.author,
    publishedAt: jsonLdData.publishedAt || meta.publishedAt,
    topImage: jsonLdData.topImage || meta.topImage,
    description: jsonLdData.description || meta.description,
  }

  let result: ExtractedArticle
  const adapter = getSiteAdapter(baseUrl)

  if (adapter) {
    const adapterResult = extractWithAdapter(adapter)
    let contentHtml = resolveRelativeUrls(adapterResult.contentHtml, baseUrl)
    const rawDate = adapterResult.publishedAt || mergedMeta.publishedAt

    result = {
      title: adapterResult.title || mergedMeta.title || document.title,
      content_html: contentHtml,
      content_md: htmlToMarkdown(contentHtml),
      source_url: baseUrl,
      top_image: mergedMeta.topImage || extractFirstImage(contentHtml),
      author: adapterResult.author || mergedMeta.author,
      published_at: parseDate(rawDate) || getTodayDate(),
      source_domain: new URL(baseUrl).hostname,
    }
  } else {
    const doc = document.cloneNode(true) as Document
    const reader = new Readability(doc, {
      charThreshold: 100,
      keepClasses: true,
    })
    const article = reader.parse()

    if (article) {
      let contentHtml = resolveRelativeUrls(article.content, baseUrl)
      const topImage = mergedMeta.topImage || extractFirstImage(contentHtml)
      const rawDate = article.publishedTime || mergedMeta.publishedAt

      result = {
        title: article.title || mergedMeta.title || document.title,
        content_html: contentHtml,
        content_md: htmlToMarkdown(contentHtml),
        source_url: baseUrl,
        top_image: topImage,
        author: article.byline || mergedMeta.author,
        published_at: parseDate(rawDate) || getTodayDate(),
        source_domain: new URL(baseUrl).hostname,
      }
    } else {
      const contentHtml = resolveRelativeUrls(extractFallbackContent(), baseUrl)

      result = {
        title: mergedMeta.title || document.title,
        content_html: contentHtml,
        content_md: htmlToMarkdown(contentHtml),
        source_url: baseUrl,
        top_image: mergedMeta.topImage || extractFirstImage(contentHtml),
        author: mergedMeta.author,
        published_at: parseDate(mergedMeta.publishedAt) || getTodayDate(),
        source_domain: new URL(baseUrl).hostname,
      }
    }
  }

  const quality = assessContentQuality(result.content_html)
  result.quality = { score: quality.score, warnings: quality.warnings }

  cachedResult = { url: currentUrl, data: result }
  return result
}
