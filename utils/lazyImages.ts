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
