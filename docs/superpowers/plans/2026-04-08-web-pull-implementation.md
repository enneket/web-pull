# page-to-md Chrome Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a WXT-based Chrome extension that extracts article content and downloads it as a .md file

**Architecture:** Simple message-passing between popup (trigger) and content script (extraction engine). No backend. Content script uses site adapters or Readability for extraction, Turndown for MD conversion, then sends result to popup for download.

**Tech Stack:** WXT framework, Vue 3, TypeScript, @mozilla/readability, turndown

---

## Phase 1: Project Scaffolding

### Task 1: Initialize WXT Project

**Files:**
- Create: `package.json`
- Create: `wxt.config.ts`
- Create: `tsconfig.json`
- Create: `manifest.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "page-to-md",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "wxt dev",
    "build": "wxt build",
    "zip": "wxt zip"
  },
  "dependencies": {
    "@mozilla/readability": "^0.5.0",
    "turndown": "^7.1.2",
    "vue": "^3.4.0"
  },
  "devDependencies": {
    "@types/turndown": "^5.0.4",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "wxt": "^0.18.0"
  }
}
```

- [ ] **Step 2: Create wxt.config.ts**

```typescript
import { defineConfig } from 'wxt'

export default defineConfig({
  entrypointsDir: 'entrypoints',
  outDir: 'dist',
  manifestVersion: 3,
})
```

- [ ] **Step 3: Create manifest.ts**

```typescript
import { defineManifest } from '@wxt_modules/manifest'

export default defineManifest({
  name: 'page-to-md',
  description: 'Extract article and download as Markdown',
  version: '1.0.0',
  permissions: ['activeTab', 'downloads'],
  action: {
    default_popup: 'popup/index.html',
    default_icon: {
      16: '/icons/icon16.png',
      48: '/icons/icon48.png',
      128: '/icons/icon128.png',
    },
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['content/extraction.ts'],
      run_at: 'document_idle',
    },
  ],
  icons: {
    16: '/icons/icon16.png',
    48: '/icons/icon48.png',
    128: '/icons/icon128.png',
  },
})
```

- [ ] **Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "types": ["wxt"]
  },
  "include": ["**/*.ts", "**/*.vue"]
}
```

---

### Task 2: Create Type Definitions

**Files:**
- Create: `types/index.ts`

- [ ] **Step 1: Create types/index.ts**

```typescript
export interface SiteAdapter {
  name: string
  match: (url: string) => boolean
  getContentSelector: () => string
  getAuthor: () => string
  getPublishedAt: () => string
  getTitle: () => string
  preProcess?: () => void
}

export interface ExtractedContent {
  title: string
  content_html: string
  content_md: string
  source_url: string
  top_image: string | null
  author: string
  published_at: string
  source_domain: string
}

export interface ContentQuality {
  score: number
  wordCount: number
  hasImages: boolean
  hasCode: boolean
  warnings: string[]
}

export interface JsonLdArticle {
  '@type'?: string
  headline?: string
  name?: string
  author?: { name?: string } | string
  datePublished?: string
  image?: { url?: string } | string
  description?: string
}
```

---

## Phase 2: Utility Functions

### Task 3: Lazy Image Handling

**Files:**
- Create: `utils/lazyImages.ts`

- [ ] **Step 1: Create utils/lazyImages.ts**

```typescript
const LAZY_IMAGE_ATTRS = [
  'data-src',
  'data-lazy-src',
  'data-original',
  'data-lazy',
  'data-url',
  'data-croporisrc',
  'data-actualsrc',
  'data-echo',
  'data-lazyload',
  'data-hi-res-src',
  'data-zoom-src',
  'data-full-src',
]

export function isPlaceholderSrc(src: string): boolean {
  if (!src) return true
  if (src.startsWith('data:image/svg+xml')) return true
  if (src.startsWith('data:image/gif;base64,R0lGOD')) return true
  if (
    src.includes('1x1') ||
    src.includes('placeholder') ||
    src.includes('blank')
  )
    return true
  if (src.includes('spacer') || src.includes('loading')) return true
  return false
}

export function processLazyImagesInElement(element: HTMLElement): void {
  element.querySelectorAll('img').forEach((img) => {
    const currentSrc = img.getAttribute('src') || ''
    if (isPlaceholderSrc(currentSrc)) {
      for (const attr of LAZY_IMAGE_ATTRS) {
        const lazySrc = img.getAttribute(attr)
        if (lazySrc && !isPlaceholderSrc(lazySrc)) {
          img.setAttribute('src', lazySrc)
          break
        }
      }
    }
  })

  element.querySelectorAll('picture source').forEach((source) => {
    const lazySrcset = source.getAttribute('data-srcset')
    if (lazySrcset) {
      source.setAttribute('srcset', lazySrcset)
    }
  })
}

export function processLazyImages(): void {
  document.querySelectorAll('img').forEach((img) => {
    const currentSrc = img.getAttribute('src') || ''
    const shouldReplace = !currentSrc || isPlaceholderSrc(currentSrc)

    if (shouldReplace) {
      for (const attr of LAZY_IMAGE_ATTRS) {
        const lazySrc = img.getAttribute(attr)
        if (lazySrc && !isPlaceholderSrc(lazySrc)) {
          img.setAttribute('src', lazySrc)
          break
        }
      }
    }

    const srcset =
      img.getAttribute('data-srcset') || img.getAttribute('data-lazy-srcset')
    if (srcset && !img.srcset) {
      img.srcset = srcset
    }
  })

  document.querySelectorAll('picture source').forEach((source) => {
    const lazySrcset = source.getAttribute('data-srcset')
    if (lazySrcset) {
      source.setAttribute('srcset', lazySrcset)
    }
  })

  document.querySelectorAll('[data-bg], [data-background-image]').forEach((el) => {
    const lazyBg =
      el.getAttribute('data-bg') || el.getAttribute('data-background-image')
    if (lazyBg) {
      (el as HTMLElement).style.backgroundImage = `url(${lazyBg})`
    }
  })
}
```

---

### Task 4: Markdown Conversion

**Files:**
- Create: `utils/markdown.ts`

- [ ] **Step 1: Create utils/markdown.ts**

```typescript
import TurndownService from 'turndown'

export function htmlToMarkdown(html: string): string {
  const turndownService = new TurndownService()
  return turndownService.turndown(html)
}
```

---

### Task 5: Quality Assessment

**Files:**
- Create: `utils/quality.ts`

- [ ] **Step 1: Create utils/quality.ts**

```typescript
import type { ContentQuality } from '../types'

export function assessContentQuality(html: string): ContentQuality {
  const warnings: string[] = []
  let score = 100

  const textContent = html.replace(/<[^>]*>/g, '')
  const wordCount = textContent.length

  if (wordCount < 200) {
    warnings.push('内容过短，可能提取不完整')
    score -= 30
  } else if (wordCount < 500) {
    warnings.push('内容较短')
    score -= 10
  }

  if (html.includes('<script') || html.includes('<style')) {
    warnings.push('内容可能包含脚本残留')
    score -= 20
  }

  const imgMatches = html.match(/<img[^>]*>/g) || []
  const imgCount = imgMatches.length
  let brokenImgCount = 0

  for (const imgTag of imgMatches) {
    if (
      imgTag.includes('data:image/gif') ||
      imgTag.includes('data:image/svg+xml')
    ) {
      brokenImgCount++
    }
  }

  if (imgCount > 0 && brokenImgCount > imgCount / 2) {
    warnings.push('部分图片可能未正确加载')
    score -= 15
  }

  const hasCode =
    html.includes('<pre') || html.includes('<code') || html.includes('```')

  return {
    score: Math.max(0, score),
    wordCount,
    hasImages: imgCount > 0,
    hasCode,
    warnings,
  }
}
```

---

### Task 6: Download Utility

**Files:**
- Create: `utils/download.ts`

- [ ] **Step 1: Create utils/download.ts**

```typescript
export function downloadMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function sanitizeFilename(title: string): string {
  return title
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 200)
}
```

---

## Phase 3: Site Adapters

### Task 7: Create Shared Adapter Utilities

**Files:**
- Create: `utils/adapters/shared.ts`

- [ ] **Step 1: Create utils/adapters/shared.ts**

```typescript
export function processLazyImagesForAdapter(): void {
  const lazyAttrs = [
    'data-src',
    'data-lazy-src',
    'data-original',
    'data-lazy',
    'data-url',
    'data-croporisrc',
    'data-actualsrc',
    'data-echo',
    'data-lazyload',
    'data-hi-res-src',
    'data-zoom-src',
    'data-full-src',
  ]

  const isPlaceholder = (src: string): boolean => {
    if (!src) return true
    if (src.startsWith('data:image/svg+xml')) return true
    if (src.startsWith('data:image/gif;base64,R0lGOD')) return true
    if (
      src.includes('1x1') ||
      src.includes('placeholder') ||
      src.includes('blank')
    )
      return true
    if (src.includes('spacer') || src.includes('loading')) return true
    return false
  }

  document.querySelectorAll('img').forEach((img) => {
    const currentSrc = img.getAttribute('src') || ''
    if (isPlaceholder(currentSrc)) {
      for (const attr of lazyAttrs) {
        const lazySrc = img.getAttribute(attr)
        if (lazySrc && !isPlaceholder(lazySrc)) {
          img.setAttribute('src', lazySrc)
          break
        }
      }
    }
  })
}
```

---

### Task 8: WeChat Adapter

**Files:**
- Create: `utils/adapters/weixin.ts`

- [ ] **Step 1: Create utils/adapters/weixin.ts**

```typescript
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
```

---

### Task 9: Zhihu Adapter

**Files:**
- Create: `utils/adapters/zhihu.ts`

- [ ] **Step 1: Create utils/adapters/zhihu.ts**

```typescript
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
```

---

### Task 10: Medium Adapter

**Files:**
- Create: `utils/adapters/medium.ts`

- [ ] **Step 1: Create utils/adapters/medium.ts**

```typescript
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
```

---

### Task 11: Juejin Adapter

**Files:**
- Create: `utils/adapters/juejin.ts`

- [ ] **Step 1: Create utils/adapters/juejin.ts**

```typescript
import type { SiteAdapter } from '../../types'

export const juejinAdapter: SiteAdapter = {
  name: 'juejin',
  match: (url) => url.includes('juejin.cn'),
  getContentSelector: () => '.article-content, .markdown-body',
  getAuthor: () => {
    const authorEl = document.querySelector('.author-name a, .username')
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('.meta-box time, .article-meta time')
    return (
      timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || ''
    )
  },
  getTitle: () => {
    const titleEl = document.querySelector('.article-title')
    return titleEl?.textContent?.trim() || document.title
  },
}
```

---

### Task 12: Remaining Adapters (Batch)

**Files:**
- Create: `utils/adapters/csdn.ts`
- Create: `utils/adapters/infoq.ts`
- Create: `utils/adapters/kr36.ts`
- Create: `utils/adapters/sspai.ts`
- Create: `utils/adapters/segmentfault.ts`
- Create: `utils/adapters/cnblogs.ts`
- Create: `utils/adapters/jianshu.ts`
- Create: `utils/adapters/oschina.ts`
- Create: `utils/adapters/huxiu.ts`
- Create: `utils/adapters/geekpark.ts`
- Create: `utils/adapters/substack.ts`
- Create: `utils/adapters/devto.ts`
- Create: `utils/adapters/hashnode.ts`
- Create: `utils/adapters/notion.ts`
- Create: `utils/adapters/twitter.ts`

- [ ] **Step 1: Create utils/adapters/csdn.ts**

```typescript
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
```

- [ ] **Step 2: Create utils/adapters/infoq.ts**

```typescript
import type { SiteAdapter } from '../../types'

export const infoqAdapter: SiteAdapter = {
  name: 'infoq',
  match: (url) => url.includes('infoq.cn') || url.includes('infoq.com'),
  getContentSelector: () => '.article-content, .article-preview',
  getAuthor: () => {
    const authorEl = document.querySelector('.author-name, .article-author')
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('.date, .article-time')
    return timeEl?.textContent?.trim() || ''
  },
  getTitle: () => {
    const titleEl = document.querySelector(
      '.article-title h1, .article-preview-title',
    )
    return titleEl?.textContent?.trim() || document.title
  },
}
```

- [ ] **Step 3: Create utils/adapters/kr36.ts**

```typescript
import type { SiteAdapter } from '../../types'
import { processLazyImagesForAdapter } from './shared'

export const kr36Adapter: SiteAdapter = {
  name: '36kr',
  match: (url) => url.includes('36kr.com'),
  getContentSelector: () => '.article-content, .common-width',
  getAuthor: () => {
    const authorEl = document.querySelector('.author-name, .article-author a')
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('.article-time, time[datetime]')
    return (
      timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || ''
    )
  },
  getTitle: () => {
    const titleEl = document.querySelector('.article-title, h1.title')
    return titleEl?.textContent?.trim() || document.title
  },
  preProcess: processLazyImagesForAdapter,
}
```

- [ ] **Step 4: Create utils/adapters/sspai.ts**

```typescript
import type { SiteAdapter } from '../../types'
import { processLazyImagesForAdapter } from './shared'

export const sspaiAdapter: SiteAdapter = {
  name: 'sspai',
  match: (url) => url.includes('sspai.com'),
  getContentSelector: () => '.article-body, .content',
  getAuthor: () => {
    const authorEl = document.querySelector('.nickname, .author-name')
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('time[datetime], .date')
    return (
      timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || ''
    )
  },
  getTitle: () => {
    const titleEl = document.querySelector('.title, h1')
    return titleEl?.textContent?.trim() || document.title
  },
  preProcess: processLazyImagesForAdapter,
}
```

- [ ] **Step 5: Create utils/adapters/segmentfault.ts**

```typescript
import type { SiteAdapter } from '../../types'

export const segmentfaultAdapter: SiteAdapter = {
  name: 'segmentfault',
  match: (url) => url.includes('segmentfault.com'),
  getContentSelector: () => '.article-content, .fmt',
  getAuthor: () => {
    const authorEl = document.querySelector('.author .name, .user-name')
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('time[datetime], .article-time')
    return (
      timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || ''
    )
  },
  getTitle: () => {
    const titleEl = document.querySelector('.article__title, h1.title')
    return titleEl?.textContent?.trim() || document.title
  },
}
```

- [ ] **Step 6: Create utils/adapters/cnblogs.ts**

```typescript
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
```

- [ ] **Step 7: Create utils/adapters/jianshu.ts**

```typescript
import type { SiteAdapter } from '../../types'
import { processLazyImagesForAdapter } from './shared'

export const jianshuAdapter: SiteAdapter = {
  name: 'jianshu',
  match: (url) => url.includes('jianshu.com'),
  getContentSelector: () => 'article, .article',
  getAuthor: () => {
    const authorEl = document.querySelector('.name, ._22gUMi')
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('time, .publish-time')
    return (
      timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || ''
    )
  },
  getTitle: () => {
    const titleEl = document.querySelector('h1, ._1RuRku')
    return titleEl?.textContent?.trim() || document.title
  },
  preProcess: processLazyImagesForAdapter,
}
```

- [ ] **Step 8: Create utils/adapters/oschina.ts**

```typescript
import type { SiteAdapter } from '../../types'

export const oschinaAdapter: SiteAdapter = {
  name: 'oschina',
  match: (url) => url.includes('oschina.net'),
  getContentSelector: () => '.article-detail, .content',
  getAuthor: () => {
    const authorEl = document.querySelector('.author-name, .user-info .name')
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('.publish-time, time')
    return (
      timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || ''
    )
  },
  getTitle: () => {
    const titleEl = document.querySelector('.article-box__title, h1')
    return titleEl?.textContent?.trim() || document.title
  },
}
```

- [ ] **Step 9: Create utils/adapters/huxiu.ts**

```typescript
import type { SiteAdapter } from '../../types'
import { processLazyImagesForAdapter } from './shared'

export const huxiuAdapter: SiteAdapter = {
  name: 'huxiu',
  match: (url) => url.includes('huxiu.com'),
  getContentSelector: () => '.article-content, .article__content',
  getAuthor: () => {
    const authorEl = document.querySelector('.author-name, .article-author')
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('.article-time, time')
    return timeEl?.textContent?.trim() || ''
  },
  getTitle: () => {
    const titleEl = document.querySelector('.article-title, h1')
    return titleEl?.textContent?.trim() || document.title
  },
  preProcess: processLazyImagesForAdapter,
}
```

- [ ] **Step 10: Create utils/adapters/geekpark.ts**

```typescript
import type { SiteAdapter } from '../../types'

export const geekparkAdapter: SiteAdapter = {
  name: 'geekpark',
  match: (url) => url.includes('geekpark.net'),
  getContentSelector: () => '.article-content, .post-content',
  getAuthor: () => {
    const authorEl = document.querySelector('.author-name, .article-author')
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('.publish-time, time')
    return timeEl?.textContent?.trim() || ''
  },
  getTitle: () => {
    const titleEl = document.querySelector('.article-title, h1')
    return titleEl?.textContent?.trim() || document.title
  },
}
```

- [ ] **Step 11: Create utils/adapters/substack.ts**

```typescript
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
```

- [ ] **Step 12: Create utils/adapters/devto.ts**

```typescript
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
```

- [ ] **Step 13: Create utils/adapters/hashnode.ts**

```typescript
import type { SiteAdapter } from '../../types'

export const hashnodeAdapter: SiteAdapter = {
  name: 'hashnode',
  match: (url) => url.includes('hashnode.dev') || url.includes('hashnode.com'),
  getContentSelector: () => '.prose, article',
  getAuthor: () => {
    const authorEl = document.querySelector(
      '.author-name, [data-testid="author-name"]',
    )
    return authorEl?.textContent?.trim() || ''
  },
  getPublishedAt: () => {
    const timeEl = document.querySelector('time[datetime]')
    return timeEl?.getAttribute('datetime') || ''
  },
  getTitle: () => {
    const titleEl = document.querySelector('h1')
    return titleEl?.textContent?.trim() || document.title
  },
}
```

- [ ] **Step 14: Create utils/adapters/notion.ts**

```typescript
import type { SiteAdapter } from '../../types'
import { processLazyImagesForAdapter } from './shared'

export const notionAdapter: SiteAdapter = {
  name: 'notion',
  match: (url) => url.includes('notion.site') || url.includes('notion.so'),
  getContentSelector: () =>
    '.notion-page-content, [class*="notion-page-content"]',
  getAuthor: () => '',
  getPublishedAt: () => '',
  getTitle: () => {
    const titleEl = document.querySelector(
      '.notion-page-block h1, [class*="notion-header-block"]',
    )
    return titleEl?.textContent?.trim() || document.title
  },
  preProcess: processLazyImagesForAdapter,
}
```

- [ ] **Step 15: Create utils/adapters/twitter.ts**

```typescript
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
```

---

### Task 13: Adapter Registry

**Files:**
- Create: `utils/adapters/index.ts`

- [ ] **Step 1: Create utils/adapters/index.ts**

```typescript
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
```

---

## Phase 4: Content Script (Core Extraction)

### Task 14: Content Extraction Script

**Files:**
- Create: `entrypoints/content/extraction.ts`

- [ ] **Step 1: Create entrypoints/content/extraction.ts**

```typescript
import { Readability } from '@mozilla/readability'
import type { ExtractedContent, JsonLdArticle } from '../../types'
import { processLazyImages } from '../../utils/lazyImages'
import { htmlToMarkdown } from '../../utils/markdown'
import { getSiteAdapter, extractWithAdapter } from '../../utils/adapters'
import { assessContentQuality } from '../../utils/quality'

let cachedResult: { url: string; data: ExtractedContent } | null = null

const LAZY_IMAGE_ATTRS = [
  'data-src',
  'data-lazy-src',
  'data-original',
  'data-lazy',
  'data-url',
  'data-croporisrc',
  'data-actualsrc',
  'data-echo',
  'data-lazyload',
  'data-hi-res-src',
  'data-zoom-src',
  'data-full-src',
]

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

  // Try ISO format first
  const isoDate = new Date(dateStr)
  if (!isNaN(isoDate.getTime())) {
    return isoDate.toISOString().split('T')[0]
  }

  // Try common Chinese format: YYYY-MM-DD
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
```

---

## Phase 5: Popup UI

### Task 15: Popup Entry Point

**Files:**
- Create: `entrypoints/popup/main.ts`
- Create: `entrypoints/popup/App.vue`

- [ ] **Step 1: Create entrypoints/popup/main.ts**

```typescript
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

- [ ] **Step 2: Create entrypoints/popup/App.vue**

```vue
<template>
  <div class="popup">
    <h1>page-to-md</h1>
    <button @click="extractAndDownload" :disabled="loading">
      {{ loading ? '提取中...' : '下载 Markdown' }}
    </button>
    <p v-if="status" :class="{ error: hasError }">{{ status }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { downloadMarkdown, sanitizeFilename } from '../utils/download'

const loading = ref(false)
const status = ref('')
const hasError = ref(false)

async function extractAndDownload() {
  loading.value = true
  status.value = ''
  hasError.value = false

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab.id) {
      throw new Error('无法获取当前标签页')
    }

    const result = await chrome.tabs.sendMessage(tab.id, {
      type: 'EXTRACT_ARTICLE',
    })

    if (!result || !result.content_md) {
      throw new Error('提取失败，请确保在文章页面使用')
    }

    const filename = `${sanitizeFilename(result.title)}.md`
    const frontMatter = `---
title: "${result.title}"
author: "${result.author}"
source: ${result.source_url}
date: ${result.published_at}
---

`

    const fullContent = frontMatter + result.content_md
    downloadMarkdown(filename, fullContent)
    status.value = `已保存: ${filename}`
  } catch (error) {
    hasError.value = true
    status.value = error instanceof Error ? error.message : '未知错误'
  } finally {
    loading.value = false
  }
}
</script>

<style>
.popup {
  padding: 16px;
  min-width: 280px;
  font-family: system-ui, sans-serif;
}
h1 {
  font-size: 16px;
  margin: 0 0 12px;
}
button {
  width: 100%;
  padding: 10px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
button:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}
p {
  margin: 12px 0 0;
  font-size: 12px;
  word-break: break-all;
}
.error {
  color: #dc2626;
}
</style>
```

- [ ] **Step 3: Create popup/index.html**

```html
<!DOCTYPE html>
<html>
  <head></head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

---

## Phase 6: Build & Package

### Task 16: Add Icon Placeholder & Build

**Files:**
- Create: `public/icons/icon16.svg` (simple placeholder)
- Modify: `wxt.config.ts` (if needed)

- [ ] **Step 1: Create icons directory and placeholder**

```bash
mkdir -p public/icons
# Create simple SVG icons for dev (can be replaced later)
```

- [ ] **Step 2: Install dependencies and test build**

Run: `npm install`
Run: `npm run build`

Expected: Build succeeds, `dist/` folder created with extension files

---

## Self-Review Checklist

1. **Spec coverage:** All features from spec implemented
2. **No placeholders:** All code is complete, no "TODO" or "TBD"
3. **Type consistency:** Types match across files
4. **File paths:** All paths use actual directory structure

---

**Plan complete.** Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
