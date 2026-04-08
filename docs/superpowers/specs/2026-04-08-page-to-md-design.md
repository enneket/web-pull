# page-to-md Chrome Extension Design

## Overview

A Chrome extension that extracts article content from any webpage and downloads it as a Markdown file. Built with WXT framework, migrating core extraction logic from the lumina collector plugin.

## Goals

- One-click extraction: click extension icon → download .md file
- No backend dependencies, fully offline capable
- Support 20+ site-specific adapters (WeChat, Zhihu, Medium, Juejin, Twitter/X, etc.)
- Clean, minimal architecture

## Non-Goals

- No backend API integration
- No article preview in popup
- No selection extraction (full page only)
- No lumina branding

## Architecture

```
popup (trigger only)
    ↓ chrome.runtime.sendMessage
content script (extraction engine)
    ↓ chrome.runtime.sendMessage
popup receives result → chrome.downloads.download()
```

## Project Structure

```
web-pull/
├── wxt.config.ts
├── manifest.ts
├── entrypoints/
│   ├── popup/
│   │   ├── App.vue          # Minimal UI: status + download button
│   │   └── main.ts
│   └── content/
│       └── extraction.ts   # Core extraction logic
├── utils/
│   ├── adapters/
│   │   ├── index.ts         # Adapter registry + factory
│   │   ├── weixin.ts
│   │   ├── zhihu.ts
│   │   ├── medium.ts
│   │   ├── juejin.ts
│   │   ├── csdn.ts
│   │   ├── infoq.ts
│   │   ├── kr36.ts
│   │   ├── sspai.ts
│   │   ├── segmentfault.ts
│   │   ├── cnblogs.ts
│   │   ├── jianshu.ts
│   │   ├── oschina.ts
│   │   ├── huxiu.ts
│   │   ├── geekpark.ts
│   │   ├── substack.ts
│   │   ├── devto.ts
│   │   ├── hashnode.ts
│   │   ├── notion.ts
│   │   └── twitter.ts
│   ├── readability.ts       # Mozilla Readability wrapper
│   ├── markdown.ts          # Turndown HTML→MD conversion
│   ├── lazyImages.ts        # Lazy load image handling
│   ├── quality.ts           # Content quality assessment
│   └── download.ts          # File download utility
└── types/
    └── index.ts
```

## Extraction Flow

1. User clicks extension icon
2. Popup sends `EXTRACT_ARTICLE` message to content script
3. Content script:
   - `processLazyImages()` - resolve lazy-loaded images
   - `extractJsonLd()` - parse JSON-LD metadata
   - `extractMetadata()` - extract meta/OG tags
   - `getSiteAdapter()` - match site-specific adapter if exists
     - If matched: use adapter's content selector
     - If not: use Mozilla Readability
   - `resolveXMediaLinks()` - resolve Twitter/X CDN image URLs
   - `assessContentQuality()` - score extraction quality
4. Convert HTML to Markdown via Turndown
5. Send result back to popup
6. Popup creates blob and triggers download

## Site Adapter Interface

```typescript
interface SiteAdapter {
  name: string
  match: (url: string) => boolean
  getContentSelector: () => string
  getAuthor: () => string
  getPublishedAt: () => string
  getTitle: () => string
  preProcess?: () => void
}
```

## Supported Sites

All adapters from lumina extension:
- WeChat (mp.weixin.qq.com)
- Zhihu
- Medium
- Juejin
- CSDN
- InfoQ
- 36Kr
- 少数派 (sspai)
- SegmentFault
- Cnblogs
- Jianshu
- OSChina
- Huxhu
- Geekpark
- Substack
- Dev.to
- Hashnode
- Notion
- Twitter/X

## Output

- Filename: `{title}.md`
- Content: Markdown converted from extracted HTML
- Encoding: UTF-8

## Cleanup from Lumina

- Remove `lumina.dom.v1` structured content schema
- Remove `source_url` references to lumina backend
- Remove API calls (saveArticle, etc.)
- Remove selection extraction logic
- Remove popup preview/edit UI

## Dependencies

- `@mozilla/readability` - DOM content extraction
- `turndown` - HTML to Markdown conversion
- WXT framework for extension scaffolding
