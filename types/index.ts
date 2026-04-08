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
