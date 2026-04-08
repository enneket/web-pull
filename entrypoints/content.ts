import { Readability } from '@mozilla/readability'
import TurndownService from 'turndown'

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'EXTRACT_ARTICLE') {
        try {
          const result = extractPage()
          sendResponse(result)
        } catch (error) {
          sendResponse({ error: String(error) })
        }
      }
      return true
    })
  },
})

function extractPage() {
  const doc = document.cloneNode(true) as Document
  const article = new Readability(doc, { charThreshold: 0 }).parse()

  if (!article) {
    return { content_md: '', title: document.title }
  }

  const turndown = new TurndownService()
  const content_md = turndown.turndown(article.content)

  return {
    title: article.title || document.title,
    content_md,
    author: article.byline || '',
    source_url: window.location.href,
    published_at: article.publishedTime || '',
    source_domain: window.location.hostname,
  }
}
