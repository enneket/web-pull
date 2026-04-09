/**
 * Content Script - WebPull 版本
 * 基于 SyncCaster Canonical AST 架构
 *
 * 保留点击图标下载功能，内容采集完全复用 SyncCaster 逻辑
 */
import { CanonicalCollector } from '../canonical-collector';

// ==================== 采集配置 ====================

const COLLECT_CONFIG = {
  readability: { keepClasses: true, maxElemsToParse: 10000, nbTopCandidates: 10 },
};

// ==================== 平台选择器 ====================

interface PlatformSelector {
  contentSelector: string | null;
  titleSelector: string;
  cleanSelectors: string[];
}

const PLATFORM_SELECTORS: Record<string, PlatformSelector> = {
  'csdn.net': {
    contentSelector: '#content_views',
    titleSelector: 'h1.title-article',
    cleanSelectors: [
      '.article-copyright', '.copyright-box', '.blog-tags-box',
      '.article-info-box', '.article-bar-top', '.article-bar-bottom',
      '.recommend-box', '.recommend-item-box', '.comment-box',
      'adsbygoogle', '[class*="ad-"]',
      'img[src*="csdnimg.cn/release/blogv2/dist/pc/img/"]',
    ],
  },
  'zhihu.com': {
    contentSelector: '.Post-RichTextContainer',
    titleSelector: 'h1.Post-Title',
    cleanSelectors: ['.RichContent-actions', '.ContentItem-actions'],
  },
  'juejin.cn': {
    contentSelector: '.article-content',
    titleSelector: 'h1.article-title',
    cleanSelectors: ['.article-suspended-panel', '.comment-box'],
  },
};

function getPlatformConfig(hostname: string): PlatformSelector | null {
  for (const [domain, config] of Object.entries(PLATFORM_SELECTORS)) {
    if (hostname.includes(domain)) {
      return config;
    }
  }
  return null;
}

// ==================== 知乎特殊处理 ====================

function fixZhihuListStructure(container: HTMLElement): void {
  container.querySelectorAll('ul, ol').forEach(list => {
    list.querySelectorAll(':scope > li').forEach(li => {
      const nextSibling = li.nextElementSibling;
      if (nextSibling && (nextSibling.tagName === 'UL' || nextSibling.tagName === 'OL')) {
        li.appendChild(nextSibling);
      }
    });
  });

  container.querySelectorAll('li').forEach(li => {
    if (li.parentElement && !['UL', 'OL'].includes(li.parentElement.tagName)) {
      const ul = document.createElement('ul');
      li.parentElement.insertBefore(ul, li);
      ul.appendChild(li);
    }
  });
}

function fixZhihuImages(container: HTMLElement): void {
  container.querySelectorAll('img').forEach(img => {
    const actual = img.getAttribute('data-actualsrc') || img.getAttribute('data-original') || img.getAttribute('data-src');
    const current = img.getAttribute('src') || '';
    if (actual && (current.startsWith('data:') || !current)) {
      img.setAttribute('src', actual);
    }
  });
}

function fixZhihuMath(container: HTMLElement): void {
  container.querySelectorAll('img.ztext-math, img[data-tex]').forEach(img => {
    const tex = img.getAttribute('data-tex') || img.getAttribute('alt') || '';
    if (tex) {
      const DS = String.fromCharCode(36);
      const span = document.createElement('span');
      span.setAttribute('data-sync-math', 'true');
      span.setAttribute('data-tex', tex);
      span.setAttribute('data-display', String(!!img.closest('figure')));
      span.textContent = (img.closest('figure') ? DS + DS + tex + DS + DS : DS + tex + DS);
      img.replaceWith(span);
    }
  });
}

// ==================== 搜索链接清理 ====================

const SEARCH_PATTERNS = [
  /so\.csdn\.net\/so\/search/,
  /blog\.csdn\.net\/.*\/search/,
  /zhihu\.com\/search/,
  /www\.zhihu\.com\/search/,
  /juejin\.cn\/search/,
  /jianshu\.com\/search/,
  /cnblogs\.com\/.*\/search/,
  /segmentfault\.com\/search/,
  /[?&]q=/,
  /[?&]keyword=/,
  /[?&]search=/,
];

function removeSearchLinks(container: HTMLElement): void {
  container.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (SEARCH_PATTERNS.some(p => p.test(href))) {
      const text = document.createTextNode(link.textContent || '');
      link.replaceWith(text);
    }
  });
}

// ==================== 公式预处理 ====================

function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

function extractFormulasFromOriginalDom(): Map<string, { tex: string; isDisplay: boolean }> {
  const formulaMap = new Map<string, { tex: string; isDisplay: boolean }>();
  const processed = new WeakSet<Element>();
  let index = 0;
  const hostname = window.location.hostname;
  const isZhihu = hostname.includes('zhihu.com');

  if (isZhihu) {
    document.querySelectorAll('[data-tex]').forEach(node => {
      if (processed.has(node)) return;
      processed.add(node);
      const tex = node.getAttribute('data-tex')?.trim();
      if (tex) {
        const id = 'formula-' + (index++);
        (node as HTMLElement).setAttribute('data-formula-id', id);
        formulaMap.set(id, { tex, isDisplay: !!node.closest('figure') || node.classList.contains('ztext-math') || node.tagName === 'IMG' });
      }
    });

    document.querySelectorAll('img.ztext-math, img[data-formula]').forEach(node => {
      if (processed.has(node)) return;
      processed.add(node);
      const tex = node.getAttribute('data-tex') || node.getAttribute('data-formula') || node.getAttribute('alt');
      if (tex?.trim()) {
        const id = 'formula-' + (index++);
        (node as HTMLElement).setAttribute('data-formula-id', id);
        formulaMap.set(id, { tex: tex.trim(), isDisplay: !!node.closest('figure') });
      }
    });

    document.querySelectorAll('.MathJax, .MathJax_Display, mjx-container').forEach(node => {
      if (processed.has(node)) return;
      processed.add(node);
      const tex = node.getAttribute('data-tex') || node.getAttribute('data-latex') || extractMathJaxAnnotation(node);
      if (tex?.trim()) {
        const id = 'formula-' + (index++);
        (node as HTMLElement).setAttribute('data-formula-id', id);
        formulaMap.set(id, { tex: tex.trim(), isDisplay: node.classList.contains('MathJax_Display') || node.hasAttribute('display') });
      }
    });
  }

  document.querySelectorAll('.katex-display, .katex--display').forEach(node => {
    if (processed.has(node)) return;
    processed.add(node);
    node.querySelectorAll('.katex').forEach(k => processed.add(k));
    const tex = extractLatexFromKatexNode(node);
    if (tex) {
      const id = 'formula-' + (index++);
      (node as HTMLElement).setAttribute('data-formula-id', id);
      formulaMap.set(id, { tex, isDisplay: true });
    }
  });

  document.querySelectorAll('.katex').forEach(node => {
    if (processed.has(node)) return;
    processed.add(node);
    const tex = extractLatexFromKatexNode(node);
    if (tex) {
      const id = 'formula-' + (index++);
      (node as HTMLElement).setAttribute('data-formula-id', id);
      formulaMap.set(id, { tex, isDisplay: false });
    }
  });

  document.querySelectorAll('script[type*="math/tex"]').forEach(script => {
    if (processed.has(script)) return;
    processed.add(script);
    const tex = script.textContent?.trim();
    if (tex) {
      const id = 'formula-' + (index++);
      (script as HTMLElement).setAttribute('data-formula-id', id);
      formulaMap.set(id, { tex, isDisplay: script.getAttribute('type')?.includes('mode=display') || false });
    }
  });

  return formulaMap;
}

function extractMathJaxAnnotation(node: Element): string {
  const annotation = node.querySelector('annotation[encoding*="tex"]');
  if (annotation?.textContent) return annotation.textContent.trim();
  const html = node.outerHTML || '';
  const match = html.match(/<annotation[^>]*encoding=["'][^"']*tex[^"']*["'][^>]*>([\s\S]*?)<\/annotation>/i);
  return match?.[1]?.trim() || '';
}

function extractLatexFromKatexNode(node: Element): string {
  const mathml = node.querySelector('.katex-mathml');
  if (!mathml) return '';

  try {
    const serializer = new XMLSerializer();
    const serialized = serializer.serializeToString(mathml);

    const annotationMatch = serialized.match(/<(?:m:)?annotation[^>]*encoding=["']application\/x-tex["'][^>]*>([\s\S]*?)<\/(?:m:)?annotation>/i);
    if (annotationMatch?.[1]) {
      const tex = decodeHtmlEntities(annotationMatch[1].trim());
      if (tex && tex.length > 0) return tex;
    }

    const fallbackMatch = serialized.match(/<(?:m:)?annotation[^>]*>([\s\S]*?)<\/(?:m:)?annotation>/i);
    if (fallbackMatch?.[1]) {
      const tex = decodeHtmlEntities(fallbackMatch[1].trim());
      if (tex && /[a-zA-Z\\{}_^]/.test(tex)) return tex;
    }
  } catch { /* XMLSerializer failed */ }

  const annotationSelectors = ['annotation[encoding="application/x-tex"]', 'annotation'];
  for (const sel of annotationSelectors) {
    try {
      const annotation = mathml.querySelector(sel);
      if (annotation?.textContent) {
        const tex = annotation.textContent.trim();
        if (tex && tex.length > 0) return tex;
      }
    } catch { /* selector failed */ }
  }

  const outerHtml = mathml.outerHTML || '';
  const outerMatch = outerHtml.match(/<annotation[^>]*encoding=["']application\/x-tex["'][^>]*>([\s\S]*?)<\/annotation>/i);
  if (outerMatch?.[1]) return decodeHtmlEntities(outerMatch[1].trim());

  const allElements = mathml.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    if (el.localName === 'annotation' || el.tagName.toLowerCase().endsWith(':annotation')) {
      const encoding = el.getAttribute('encoding') || '';
      if (encoding.includes('tex') || !encoding) {
        const tex = el.textContent?.trim();
        if (tex && tex.length > 0 && /[a-zA-Z\\{}_^]/.test(tex)) return tex;
      }
    }
  }

  return '';
}

function replaceFormulasWithPlaceholders(root: HTMLElement, formulaMap: Map<string, { tex: string; isDisplay: boolean }>): void {
  const doc = root.ownerDocument || document;
  const DS = String.fromCharCode(36);

  root.querySelectorAll('[data-formula-id]').forEach(node => {
    const id = node.getAttribute('data-formula-id');
    if (!id) return;
    const formula = formulaMap.get(id);
    if (!formula) return;

    const wrapper = doc.createElement('span');
    wrapper.setAttribute('data-sync-math', 'true');
    wrapper.setAttribute('data-tex', formula.tex);
    wrapper.setAttribute('data-display', String(formula.isDisplay));
    wrapper.textContent = formula.isDisplay ? DS + DS + formula.tex + DS + DS : DS + formula.tex + DS;
    node.replaceWith(wrapper);
  });
}

// ==================== 主采集函数 ====================

async function collectContent() {
  try {
    const url = window.location.href;
    const hostname = window.location.hostname;
    const platformConfig = getPlatformConfig(hostname);

    const formulaMap = extractFormulasFromOriginalDom();

    if (platformConfig) {
      const contentEl = document.querySelector(platformConfig.contentSelector);
      if (contentEl) {
        return await collectFromPlatform(contentEl as HTMLElement, platformConfig, hostname, formulaMap, url);
      }
    }

    return await collectWithReadability(formulaMap, url);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[content:collect] 采集异常:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

async function collectFromPlatform(
  contentEl: HTMLElement,
  config: PlatformSelector,
  hostname: string,
  formulaMap: Map<string, { tex: string; isDisplay: boolean }>,
  url: string
) {
  const contentClone = contentEl.cloneNode(true) as HTMLElement;

  for (const selector of config.cleanSelectors) {
    contentClone.querySelectorAll(selector).forEach(el => el.remove());
  }

  if (hostname.includes('zhihu.com')) {
    fixZhihuListStructure(contentClone);
    fixZhihuImages(contentClone);
    fixZhihuMath(contentClone);
  }

  contentClone.querySelectorAll('script, style, noscript, iframe[src*="ad"], .ad, .ads, .advertisement').forEach(el => el.remove());
  removeSearchLinks(contentClone);

  replaceFormulasWithPlaceholders(contentClone, formulaMap);

  const titleEl = document.querySelector(config.titleSelector);
  const title = titleEl?.textContent?.trim() || document.title || '未命名标题';

  const collector = new CanonicalCollector({
    useReadability: false,
    preserveUnknownHtml: true,
  });

  const result = await collector.collectFromDocument(contentClone.ownerDocument, url);

  if (result.success && result.post) {
    return {
      success: true,
      data: {
        title: result.post.title || title,
        url,
        summary: result.post.summary,
        body_md: result.post.body_md,
        body_html: contentClone.innerHTML,
        images: result.post.assets?.filter(a => a.type === 'image').map(a => ({
          type: 'image' as const,
          url: a.url,
          alt: a.alt,
          title: a.title,
        })) || [],
        formulas: result.post.formulas || [],
        wordCount: result.post.body_md.length,
        imageCount: result.post.assets?.filter(a => a.type === 'image').length || 0,
        formulaCount: result.post.formulas?.length || 0,
        mermaidCount: 0,
      },
    };
  }

  return result;
}

async function collectWithReadability(
  formulaMap: Map<string, { tex: string; isDisplay: boolean }>,
  url: string
) {
  const cloned = document.cloneNode(true) as Document;
  replaceFormulasWithPlaceholders(cloned.body as HTMLElement, formulaMap);

  const collector = new CanonicalCollector({
    useReadability: true,
    preserveUnknownHtml: true,
  });

  const result = await collector.collectFromDocument(cloned, url);

  if (result.success && result.post) {
    return {
      success: true,
      data: {
        title: result.post.title,
        url,
        summary: result.post.summary,
        body_md: result.post.body_md,
        body_html: '',
        images: result.post.assets?.filter(a => a.type === 'image').map(a => ({
          type: 'image' as const,
          url: a.url,
          alt: a.alt,
          title: a.title,
        })) || [],
        formulas: result.post.formulas || [],
        wordCount: result.post.body_md.length,
        imageCount: result.post.assets?.filter(a => a.type === 'image').length || 0,
        formulaCount: result.post.formulas?.length || 0,
        mermaidCount: 0,
      },
    };
  }

  return result;
}

// ==================== 初始化 ====================

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message && typeof message === 'object' && 'type' in message) {
        const msg = message as { type: string };
        if (msg.type === 'EXTRACT_ARTICLE') {
          collectContent().then((result) => {
            if (result.success && result.data?.body_md) {
              try {
                const { title, body_md } = result.data;
                const filename = `${sanitizeFilename(title || 'untitled')}.md`;
                const blob = new Blob([body_md], { type: 'text/markdown' });
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(blobUrl);
                result.data.downloaded = true;
              } catch (downloadError) {
                result.downloadError = String(downloadError);
              }
            }
            sendResponse(result);
          }).catch((e: Error) => sendResponse({ success: false, error: e.message }));
          return true;
        }
      }
      return false;
    });
  },
});

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '-').slice(0, 200) || 'untitled';
}
