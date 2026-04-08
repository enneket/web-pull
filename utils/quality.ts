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
