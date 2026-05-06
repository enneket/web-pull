/**
 * Content Script - WebPull
 * 基于 SyncCaster 的 Turndown 采集架构
 */
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { Readability } from '@mozilla/readability';
import {
  computeMetrics,
  extractFormulas,
  flattenCodeHighlights,
  cleanDOMWithWhitelist,
  extractAndNormalizeImages,
  checkQuality,
  normalizeBlockSpacing,
  normalizeMathInDom,
  normalizeMermaidInDom,
  extractMermaidBlocks,
  normalizeTaskListInDom,
} from '../utils/collector-utils';
import { processLazyImagesInElement } from '../utils/lazyImages';

// ==================== 采集配置 ====================

const COLLECT_CONFIG = {
  readability: { keepClasses: true, maxElemsToParse: 10000, nbTopCandidates: 10 },
  quality: { images: 0.3, formulas: 0.5, tables: 0.5, mermaid: 0.5 },
};

// ==================== 平台选择器 ====================

interface PlatformSelector {
  contentSelector: string | null;
  titleSelector: string;
  cleanSelectors: string[];
  processLazyImages?: boolean;
  removeEmptyListItems?: boolean;
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
  'mp.weixin.qq.com': {
    contentSelector: '#js_content',
    titleSelector: '#activity-name',
    cleanSelectors: [],
  },
};

function getPlatformConfig(hostname: string): PlatformSelector | null {
  for (const [domain, config] of Object.entries(PLATFORM_SELECTORS)) {
    if (hostname.includes(domain)) return config;
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

  normalizeMathInDom(root);
}

// ==================== 平台内容清理 ====================

function cleanPlatformContent(container: HTMLElement, hostname: string): void {
  if (hostname.includes('csdn.net')) {
    container.querySelectorAll('.article-copyright, .copyright-box, .blog-tags-box').forEach(el => el.remove());
    container.querySelectorAll('.article-info-box, .article-bar-top, .article-bar-bottom').forEach(el => el.remove());
    container.querySelectorAll('.recommend-box, .recommend-item-box').forEach(el => el.remove());
    container.querySelectorAll('.comment-box, #comment').forEach(el => el.remove());
    container.querySelectorAll('.adsbygoogle, [class*="ad-"]').forEach(el => el.remove());
    container.querySelectorAll('img[src*="csdnimg.cn/release/blogv2/dist/pc/img/"]').forEach(el => el.remove());
    container.querySelectorAll('[style*="display: none"], [style*="display:none"]').forEach(el => el.remove());
  }

  if (hostname.includes('zhihu.com')) {
    container.querySelectorAll('.RichContent-actions, .ContentItem-actions').forEach(el => el.remove());
    fixZhihuListStructure(container);
    container.querySelectorAll('img').forEach(img => {
      const actualSrc = img.getAttribute('data-actualsrc') || img.getAttribute('data-original') || img.getAttribute('data-src');
      const currentSrc = img.getAttribute('src') || '';
      if (actualSrc && (currentSrc.startsWith('data:') || !currentSrc)) {
        img.setAttribute('src', actualSrc);
      }
    });
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

  if (hostname.includes('juejin.cn')) {
    container.querySelectorAll('.article-suspended-panel, .comment-box').forEach(el => el.remove());
  }

  container.querySelectorAll('script, style, noscript, iframe[src*="ad"], .ad, .ads, .advertisement').forEach(el => el.remove());
  removeSearchLinks(container);
}

// ==================== Turndown 配置 ====================

function createTurndownService(): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '_',
    bulletListMarker: '-',
    br: '\n',
  });
  td.use(gfm);

  const DS = String.fromCharCode(36);

  // 多 <code> 子元素的 <pre> 规则（微信文章每个代码行用独立 <code> 包裹）
  td.addRule('multi-code-pre', {
    filter(node: HTMLElement) {
      if (node.nodeName !== 'PRE') return false;
      const codes = node.querySelectorAll(':scope > code');
      return codes.length > 1;
    },
    replacement(_content: string, node: HTMLElement) {
      const codes = node.querySelectorAll(':scope > code');
      const langMatch = (codes[0]?.className || '').match(/language-(\w+)/);
      const lang = langMatch?.[1] || (node as HTMLElement).getAttribute('data-lang') || '';
      const lines: string[] = [];
      codes.forEach(code => lines.push(code.textContent || ''));
      const codeStr = lines.join('\n').replace(/\n+$/, '');
      return '\n\n```' + lang + '\n' + codeStr + '\n```\n\n';
    },
  });

  // 公式规则
  td.addRule('sync-math', {
    filter(node: HTMLElement) {
      return node.nodeType === 1 && (node as Element).hasAttribute('data-sync-math');
    },
    replacement(_content: string, node: HTMLElement) {
      const el = node as Element;
      const tex = el.getAttribute('data-tex') || '';
      const display = el.getAttribute('data-display') === 'true';
      return display ? '\n\n' + DS + DS + '\n' + tex + '\n' + DS + DS + '\n\n' : DS + tex + DS;
    },
  });

  // KaTeX 兜底规则
  td.addRule('katex-fallback', {
    filter(node: HTMLElement) {
      if (node.nodeType !== 1) return false;
      const el = node as Element;
      return el.classList?.contains('katex') || el.classList?.contains('katex-display') || el.classList?.contains('katex--display');
    },
    replacement(_content: string, node: HTMLElement) {
      const el = node as Element;
      const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
      const tex = annotation?.textContent?.trim() || '';
      if (!tex) return _content;
      const isDisplay = el.classList?.contains('katex-display') || el.classList?.contains('katex--display');
      return isDisplay ? '\n\n' + DS + DS + '\n' + tex + '\n' + DS + DS + '\n\n' : DS + tex + DS;
    },
  });

  // 复杂表格规则
  td.addRule('complex-table', {
    filter(node: HTMLElement) {
      if (node.nodeName !== 'TABLE') return false;
      return !!(node as HTMLTableElement).querySelector('colgroup, [colspan], [rowspan]');
    },
    replacement(_content: string, node: HTMLElement) {
      return '\n\n' + (node as Element).outerHTML + '\n\n';
    },
  });

  // Mermaid 图规则
  td.addRule('mermaid-block', {
    filter(node: HTMLElement) {
      if (node.nodeType !== 1) return false;
      const el = node as Element;
      if (el.hasAttribute('data-sync-mermaid')) return true;
      if (el.tagName === 'CODE' && el.classList?.contains('language-mermaid')) return true;
      if (el.classList?.contains('mermaid')) return true;
      return false;
    },
    replacement(_content: string, node: HTMLElement) {
      const el = node as Element;
      let code = '';
      if (el.hasAttribute('data-sync-mermaid')) {
        const codeEl = el.querySelector('code');
        code = codeEl?.textContent || '';
      } else if (el.tagName === 'CODE') {
        code = el.textContent || '';
      } else if (el.classList?.contains('mermaid')) {
        code = el.getAttribute('data-mermaid-source') || el.getAttribute('data-source') || el.getAttribute('data-graph-code') || '';
        if (!code && !el.querySelector('svg')) code = el.textContent || '';
      }
      if (!code.trim()) return _content;
      return '\n\n```mermaid\n' + code.trim() + '\n```\n\n';
    },
  });

  // 任务列表规则
  td.addRule('taskListItem', {
    filter(node: HTMLElement) {
      if (node.nodeName !== 'LI') return false;
      if (node.querySelector('input[type="checkbox"]')) return true;
      if (node.classList?.contains('task-list-item')) return true;
      if (node.hasAttribute('data-task')) return true;
      return false;
    },
    replacement(content: string, node: HTMLElement) {
      const checkbox = node.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      const isChecked = checkbox?.checked || checkbox?.hasAttribute('checked') ||
        node.getAttribute('data-checked') === 'true' ||
        node.classList?.contains('checked') || node.classList?.contains('completed');
      let cleanContent = content.replace(/^\s*\[[ x]\]\s*/i, '').trim();
      const marker = isChecked ? '[x]' : '[ ]';
      return '- ' + marker + ' ' + cleanContent + '\n';
    },
  });

  // 删除线规则
  td.addRule('strikethrough', {
    filter: ['del', 's', 'strike'],
    replacement(content: string) {
      if (!content.trim()) return '';
      return '~~' + content + '~~';
    },
  });

  // 斜体规则
  td.addRule('emphasis', {
    filter(node: HTMLElement) {
      const tagName = node.nodeName.toLowerCase();
      if (tagName === 'em' || tagName === 'i') return true;
      if (tagName === 'span') {
        const style = node.getAttribute('style') || '';
        if (style.includes('italic') || style.includes('oblique')) return true;
        if (node.classList?.contains('italic') || node.classList?.contains('em')) return true;
      }
      return false;
    },
    replacement(content: string) {
      if (!content.trim()) return '';
      const trimmed = content.trim();
      if (trimmed.startsWith('_') && trimmed.endsWith('_')) return trimmed;
      return '_' + trimmed + '_';
    },
  });

  return td;
}

// ==================== 主采集函数 ====================

async function collectContent() {
  try {
    const url = window.location.href;
    const hostname = window.location.hostname;
    const platformConfig = getPlatformConfig(hostname);
    const formulaMap = extractFormulasFromOriginalDom();

    if (platformConfig && platformConfig.contentSelector) {
      const contentEl = document.querySelector(platformConfig.contentSelector);
      if (contentEl) {
        return await collectFromPlatform(contentEl as HTMLElement, platformConfig, hostname, formulaMap, url);
      }
    }

    return await collectWithReadability(formulaMap, url);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
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
  }

  if (config.processLazyImages) {
    processLazyImagesInElement(contentClone);
  }

  if (config.removeEmptyListItems) {
    contentClone.querySelectorAll('li').forEach(li => {
      const hasText = li.textContent?.trim();
      const hasChildren = li.querySelector('p, span, strong, em, a, img');
      if (!hasText && !hasChildren) li.remove();
    });
  }

  contentClone.querySelectorAll('script, style, noscript, iframe[src*="ad"], .ad, .ads, .advertisement').forEach(el => el.remove());
  removeSearchLinks(contentClone);
  replaceFormulasWithPlaceholders(contentClone, formulaMap);

  const titleEl = document.querySelector(config.titleSelector);
  const title = titleEl?.textContent?.trim() || document.title || '未命名标题';

  const skipClean = hostname.includes('mp.weixin.qq.com');
  return convertDomToMarkdown(contentClone, title, url, skipClean);
}

async function collectWithReadability(
  formulaMap: Map<string, { tex: string; isDisplay: boolean }>,
  url: string
) {
  const cloned = document.cloneNode(true) as Document;
  processLazyImagesInElement(cloned.body as HTMLElement);
  replaceFormulasWithPlaceholders(cloned.body as HTMLElement, formulaMap);

  const article = new Readability(cloned, COLLECT_CONFIG.readability).parse();
  const title = article?.title || document.title || '未命名标题';
  const bodyHtml = article?.content || '';

  const container = document.createElement('div');
  container.innerHTML = bodyHtml;

  return convertDomToMarkdown(container, title, url);
}

function convertDomToMarkdown(
  container: HTMLElement,
  title: string,
  url: string,
  skipClean = false
) {
  const initialMetrics = computeMetrics(container.innerHTML);

  const formulas = extractFormulas(container);
  flattenCodeHighlights(container);

  try { normalizeMermaidInDom(container); } catch { /* ignore */ }

  let mermaidBlocks: { type: 'mermaid'; code: string; diagramType?: string }[] = [];
  try { mermaidBlocks = extractMermaidBlocks(container); } catch { /* ignore */ }

  try { normalizeTaskListInDom(container); } catch { /* ignore */ }
  if (!skipClean) {
    try { cleanDOMWithWhitelist(container); } catch { /* ignore */ }
  }

  let images: ReturnType<typeof extractAndNormalizeImages> = [];
  try { images = extractAndNormalizeImages(container); } catch { /* ignore */ }

  if (!skipClean) {
    try { normalizeBlockSpacing(container); } catch { /* ignore */ }
  }

  const bodyHtml = container.innerHTML;
  const td = createTurndownService();
  let bodyMd = td.turndown(bodyHtml || '');
  bodyMd = bodyMd.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\s*\n+/, '').replace(/\n+\s*$/, '');

  const summary = (container.textContent || '').trim().slice(0, 200);
  const finalMetrics = computeMetrics(bodyHtml);
  const qualityCheck = checkQuality(initialMetrics, finalMetrics, COLLECT_CONFIG.quality);

  return {
    success: true,
    data: {
      title, url, summary,
      body_md: bodyMd,
      body_html: container.innerHTML,
      images,
      formulas: formulas.map(f => ({ type: f.display ? 'blockMath' as const : 'inlineMath' as const, latex: f.latex })),
      mermaid: mermaidBlocks.map(m => ({ code: m.code, diagramType: m.diagramType })),
      wordCount: bodyMd.length,
      imageCount: images.length,
      formulaCount: formulas.length,
      mermaidCount: mermaidBlocks.length,
      useHtmlFallback: !qualityCheck.pass,
      qualityCheck,
    },
  };
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
