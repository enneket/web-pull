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
