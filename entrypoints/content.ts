/**
 * Content Script - WebPull 版本
 * 基于 SyncCaster 完整功能
 */
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { Readability } from '@mozilla/readability'

const COLLECT_CONFIG = {
  readability: { keepClasses: true, maxElemsToParse: 10000, nbTopCandidates: 10 },
  quality: { images: 0.3, formulas: 0.5, tables: 0.5, mermaid: 0.5 },
};

// ==================== 类型定义 ====================
export interface CollectedImage {
  type: 'image'; url: string; alt?: string; title?: string;
  width?: number; height?: number; source?: 'img' | 'picture' | 'noscript' | 'background';
}
export interface CollectedFormula {
  type: 'formula'; latex: string; display: boolean;
  engine: 'katex' | 'mathjax2' | 'mathjax3' | 'mathml' | 'unknown'; originalFormat?: string;
}
export interface CollectedMermaid { type: 'mermaid'; code: string; diagramType?: string; }
export interface Metrics { images: number; formulas: number; tables: number; mermaid: number; codeBlocks: number; }
export interface QualityResult { pass: boolean; score: number; issues: string[]; }

// ==================== DOM 清洗白名单 ====================
const WHITELIST_TAGS = new Set(['h1','h2','h3','h4','h5','h6','p','br','hr','ul','ol','li','blockquote','pre','code','a','img','table','thead','tbody','tr','th','td','div','span','strong','b','em','i','u','s','del','sup','sub','input','figure','figcaption','section','article','header','footer','aside','main','nav','details','summary','math','semantics','annotation','mjx-container','svg','path','circle','rect','line','polyline','polygon','g','defs','use','style','symbol','br','wbr','code','pre','kbd','samp','var','mark','time','meter','progress']);

function cleanDOMWithWhitelist(container: HTMLElement): void {
  const remove = (el: Element) => {
    const text = document.createTextNode(el.textContent || '');
    el.parentNode?.replaceChild(text, el);
  };
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
  const toRemove: Element[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const el = node as Element;
    if (!WHITELIST_TAGS.has(el.tagName.toLowerCase()) && !el.hasAttribute('data-sync-math') && !el.hasAttribute('data-sync-mermaid')) {
      toRemove.push(el);
    }
  }
  toRemove.forEach(el => {
    try { remove(el); } catch { /* already removed */ }
  });
}

// ==================== 图片归一化 ====================
const LAZY_ATTRS = ['data-src','data-lazy-src','data-original','data-lazy','data-url','data-actualsrc','data-echo','data-lazyload','data-hi-res-src','data-zoom-src','data-full-src'];
const PLACEHOLDER_PATTERNS = ['data:image/svg+xml','data:image/gif;base64','1x1','placeholder','blank','spacer','loading'];

function isPlaceholder(src: string): boolean {
  if (!src) return true;
  return PLACEHOLDER_PATTERNS.some(p => src.includes(p));
}

function extractAndNormalizeImages(container: HTMLElement): CollectedImage[] {
  const images: CollectedImage[] = [];
  const seen = new Set<string>();

  container.querySelectorAll('img').forEach(img => {
    let src = img.getAttribute('src') || '';
    if (isPlaceholder(src)) {
      for (const attr of LAZY_ATTRS) {
        const val = img.getAttribute(attr);
        if (val && !isPlaceholder(val)) { src = val; break; }
      }
    }
    if (src && !seen.has(src)) {
      seen.add(src);
      images.push({ type: 'image', url: src, alt: img.getAttribute('alt') || undefined, title: img.getAttribute('title') || undefined, width: img.width || undefined, height: img.height || undefined, source: 'img' });
    }
  });

  container.querySelectorAll('picture source').forEach((source: Element) => {
    const srcset = source.getAttribute('srcset') || '';
    const src = srcset.split(',')[0]?.trim().split(' ')[0] || '';
    if (src && !seen.has(src)) { seen.add(src); images.push({ type: 'image', url: src, source: 'picture' }); }
  });

  container.querySelectorAll('[data-bg], [data-background-image]').forEach((el: Element) => {
    const bg = (el as HTMLElement).style.backgroundImage || el.getAttribute('data-bg') || el.getAttribute('data-background-image') || '';
    const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
    if (match?.[1] && !seen.has(match[1])) { seen.add(match[1]); images.push({ type: 'image', url: match[1], source: 'background' }); }
  });

  return images;
}

// ==================== 代码高亮扁平化 ====================
function flattenCodeHighlights(container: HTMLElement): void {
  container.querySelectorAll('[class*="highlight-"], [class*="code-block"], pre').forEach(pre => {
    pre.querySelectorAll('.line-number, .line-numbers, .gutter, .highlighter-rouge .rouge-code').forEach(el => el.remove());
    pre.querySelectorAll('[class*="line-"]').forEach((el, i) => {
      const text = el.textContent?.trim();
      if (text) {
        const span = document.createElement('span');
        span.textContent = (i > 0 ? '\n' : '') + text;
        el.replaceWith(span);
      }
    });
  });
}

// ==================== 公式提取 ====================
function extractFormulas(container: HTMLElement): CollectedFormula[] {
  const formulas: CollectedFormula[] = [];
  container.querySelectorAll('[data-sync-math]').forEach(el => {
    const tex = el.getAttribute('data-tex') || '';
    const display = el.getAttribute('data-display') === 'true';
    if (tex) formulas.push({ type: 'formula', latex: tex, display, engine: 'unknown' });
  });
  return formulas;
}

// ==================== Mermaid ====================
function normalizeMermaidInDom(container: HTMLElement): void {
  container.querySelectorAll('.mermaid, [class*="mermaid"]').forEach(el => {
    const codeEl = el.querySelector('code');
    const code = codeEl?.textContent || el.getAttribute('data-mermaid-source') || el.textContent || '';
    if (code.trim()) {
      el.setAttribute('data-sync-mermaid', 'true');
      if (!codeEl) {
        const newCode = document.createElement('code');
        newCode.textContent = code.trim();
        el.textContent = '';
        el.appendChild(newCode);
      }
    }
  });
}

function extractMermaidBlocks(container: HTMLElement): CollectedMermaid[] {
  const blocks: CollectedMermaid[] = [];
  container.querySelectorAll('[data-sync-mermaid]').forEach(el => {
    const codeEl = el.querySelector('code');
    const code = codeEl?.textContent?.trim() || '';
    if (code) blocks.push({ type: 'mermaid', code });
  });
  return blocks;
}

// ==================== 任务列表 ====================
function normalizeTaskListInDom(container: HTMLElement): void {
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    if (!cb.closest('li')) {
      const li = document.createElement('li');
      cb.parentNode?.insertBefore(li, cb);
      li.appendChild(cb);
    }
  });
}

// ==================== 数学归一化 ====================
function normalizeMathInDom(_root: HTMLElement): void {
  // 数学预处理已在 extractFormulasFromOriginalDom 完成
}

// ==================== 段落归一化 ====================
function normalizeBlockSpacing(container: HTMLElement): void {
  container.querySelectorAll('p, div').forEach(el => {
    if (el.textContent?.trim() === '') el.remove();
  });
  let prev: Element | null = null;
  container.querySelectorAll('p, pre, blockquote, table').forEach(el => {
    if (prev && prev.tagName === el.tagName && el.tagName !== 'TABLE') {
      prev.appendChild(document.createElement('br'));
      prev.appendChild(document.createTextNode(el.textContent || ''));
      el.remove();
    } else {
      prev = el;
    }
  });
}

// ==================== 指标计算 ====================
function computeMetrics(html: string): Metrics {
  const div = document.createElement('div');
  div.innerHTML = html;
  return {
    images: div.querySelectorAll('img').length,
    formulas: div.querySelectorAll('[data-sync-math], .katex, .MathJax, mjx-container').length,
    tables: div.querySelectorAll('table').length,
    mermaid: div.querySelectorAll('[data-sync-mermaid]').length,
    codeBlocks: div.querySelectorAll('pre, code').length,
  };
}

function checkQuality(initial: Metrics, final: Metrics, config: { images: number; formulas: number; tables: number; mermaid: number }): QualityResult {
  const issues: string[] = [];
  if (initial.images > 5 && final.images / initial.images < 0.5) issues.push('images');
  if (initial.formulas > 3 && final.formulas / initial.formulas < 0.3) issues.push('formulas');
  if (initial.tables > 1 && final.tables === 0) issues.push('tables');
  if (initial.mermaid > 0 && final.mermaid === 0) issues.push('mermaid');
  return { pass: issues.length === 0, score: Math.max(0, 100 - issues.length * 20), issues };
}

// ==================== 工具函数 ====================
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

  const rawText = mathml.textContent || '';
  if (!rawText) return '';
  const text = rawText.replace(/\s+/g, '').trim();
  if (!text) return '';

  const len = text.length;
  if (len >= 2 && len % 2 === 0) {
    const half = len / 2;
    if (text.substring(0, half) === text.substring(half)) return text.substring(half);
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

// ==================== 主采集函数 ====================
async function collectContent() {
  try {
    const url = window.location.href;
    const hostname = window.location.hostname;

    const formulaMap = extractFormulasFromOriginalDom();

    const getPlatformContent = (): HTMLElement | null => {
      if (hostname.includes('csdn.net')) {
        const c = document.querySelector('#content_views') as HTMLElement;
        if (c) return c;
        return document.querySelector('.article_content') as HTMLElement;
      }
      if (hostname.includes('zhihu.com')) {
        return document.querySelector('.Post-RichTextContainer') as HTMLElement;
      }
      if (hostname.includes('juejin.cn')) {
        return document.querySelector('.article-content') as HTMLElement;
      }
      return null;
    };

    const cleanPlatformContent = (container: HTMLElement) => {
      if (hostname.includes('csdn.net')) {
        container.querySelectorAll('.article-copyright, .copyright-box, .blog-tags-box, .article-info-box, .article-bar-top, .article-bar-bottom, .recommend-box, .recommend-item-box, .comment-box, .adsbygoogle, [class*="ad-"], img[src*="csdnimg.cn/release/blogv2/dist/pc/img/"]').forEach(el => el.remove());
      }
      if (hostname.includes('zhihu.com')) {
        container.querySelectorAll('.RichContent-actions, .ContentItem-actions').forEach(el => el.remove());
        fixZhihuListStructure(container);
        container.querySelectorAll('img').forEach(img => {
          const actual = img.getAttribute('data-actualsrc') || img.getAttribute('data-original') || img.getAttribute('data-src');
          const current = img.getAttribute('src') || '';
          if (actual && (current.startsWith('data:') || !current)) img.setAttribute('src', actual);
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
      const searchPatterns = [/so\.csdn\.net\/so\/search/, /zhihu\.com\/search/, /juejin\.cn\/search/, /jianshu\.com\/search/, /cnblogs\.com\/.*\/search/, /segmentfault\.com\/search/, /[?&]q=/, /[?&]keyword=/, /[?&]search=/];
      container.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href') || '';
        if (searchPatterns.some(p => p.test(href))) {
          const text = document.createTextNode(link.textContent || '');
          link.replaceWith(text);
        }
      });
    };

    const platformContent = getPlatformContent();
    let body_html = '';
    let title = '';

    if (platformContent) {
      const contentClone = platformContent.cloneNode(true) as HTMLElement;
      cleanPlatformContent(contentClone);
      replaceFormulasWithPlaceholders(contentClone, formulaMap);
      body_html = contentClone.innerHTML;
      const titleEl = document.querySelector('h1.title-article, h1[class*="title"], .article-title, h1') as HTMLElement;
      title = titleEl?.textContent?.trim() || document.title || '未命名标题';
    } else {
      const cloned = document.cloneNode(true) as Document;
      replaceFormulasWithPlaceholders(cloned.body as HTMLElement, formulaMap);
      const article = new Readability(cloned, COLLECT_CONFIG.readability).parse();
      title = article?.title || document.title || '未命名标题';
      body_html = article?.content || '';
    }

    const initialMetrics = computeMetrics(body_html);

    const container = document.createElement('div');
    container.innerHTML = body_html;

    const formulas = extractFormulas(container);
    flattenCodeHighlights(container);
    normalizeMermaidInDom(container);
    const mermaidBlocks = extractMermaidBlocks(container);
    normalizeTaskListInDom(container);
    cleanDOMWithWhitelist(container);
    const images = extractAndNormalizeImages(container);
    normalizeBlockSpacing(container);

    body_html = container.innerHTML;

    const td = new TurndownService({
      headingStyle: 'atx', codeBlockStyle: 'fenced', emDelimiter: '_', bulletListMarker: '-', br: '\n',
    });
    td.use(gfm);

    const DS = String.fromCharCode(36);

    td.addRule('sync-math', {
      filter: (node: HTMLElement) => node.nodeType === 1 && (node as Element).hasAttribute('data-sync-math'),
      replacement: (_content: string, node: HTMLElement) => {
        const el = node as Element;
        const tex = el.getAttribute('data-tex') || '';
        const display = el.getAttribute('data-display') === 'true';
        return display ? '\n\n' + DS + DS + '\n' + tex + '\n' + DS + DS + '\n\n' : DS + tex + DS;
      },
    });

    td.addRule('katex-fallback', {
      filter: (node: HTMLElement) => {
        if (node.nodeType !== 1) return false;
        const el = node as Element;
        return el.classList?.contains('katex') || el.classList?.contains('katex-display') || el.classList?.contains('katex--display');
      },
      replacement: (_content: string, node: HTMLElement) => {
        const el = node as Element;
        const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
        const tex = annotation?.textContent?.trim() || '';
        if (!tex) return _content;
        const isDisplay = el.classList?.contains('katex-display') || el.classList?.contains('katex--display');
        return isDisplay ? '\n\n' + DS + DS + '\n' + tex + '\n' + DS + DS + '\n\n' : DS + tex + DS;
      },
    });

    td.addRule('complex-table', {
      filter: (node: HTMLElement) => node.nodeName === 'TABLE' && !!(node as HTMLTableElement).querySelector('colgroup, [colspan], [rowspan]'),
      replacement: (_content: string, node: HTMLElement) => '\n\n' + (node as Element).outerHTML + '\n\n',
    });

    td.addRule('mermaid-block', {
      filter: (node: HTMLElement) => {
        if (node.nodeType !== 1) return false;
        const el = node as Element;
        if (el.hasAttribute?.('data-sync-mermaid')) return true;
        if (el.tagName === 'CODE' && el.classList?.contains('language-mermaid')) return true;
        if (el.classList?.contains('mermaid')) return true;
        return false;
      },
      replacement: (_content: string, node: HTMLElement) => {
        const el = node as Element;
        let code = '';
        if (el.hasAttribute?.('data-sync-mermaid')) {
          code = el.querySelector('code')?.textContent || '';
        } else if (el.tagName === 'CODE') {
          code = el.textContent || '';
        } else if (el.classList?.contains('mermaid')) {
          code = el.getAttribute('data-mermaid-source') || el.textContent || '';
        }
        if (!code.trim()) return _content;
        return '\n\n```mermaid\n' + code.trim() + '\n```\n\n';
      },
    });

    td.addRule('taskListItem', {
      filter: (node: HTMLElement) => {
        if (node.nodeName !== 'LI') return false;
        if (node.querySelector('input[type="checkbox"]')) return true;
        if (node.classList?.contains('task-list-item')) return true;
        if (node.hasAttribute('data-task')) return true;
        return false;
      },
      replacement: (content: string, node: HTMLElement) => {
        const checkbox = node.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
        const isChecked = checkbox?.checked || checkbox?.hasAttribute('checked') || node.getAttribute('data-checked') === 'true' || node.classList?.contains('checked') || node.classList?.contains('completed');
        const cleanContent = content.replace(/^\s*\[[ x]\]\s*/i, '').trim();
        const marker = isChecked ? '[x]' : '[ ]';
        return '- ' + marker + ' ' + cleanContent + '\n';
      },
    });

    td.addRule('strikethrough', {
      filter: ['del', 's', 'strike'],
      replacement: (content: string) => {
        if (!content.trim()) return '';
        return '~~' + content + '~~';
      },
    });

    td.addRule('emphasis', {
      filter: (node: HTMLElement) => {
        const tag = node.nodeName.toLowerCase();
        if (tag === 'em' || tag === 'i') return true;
        if (tag === 'span') {
          const style = node.getAttribute('style') || '';
          if (style.includes('italic') || style.includes('oblique')) return true;
          if (node.classList?.contains('italic') || node.classList?.contains('em')) return true;
        }
        return false;
      },
      replacement: (content: string) => {
        if (!content.trim()) return '';
        const trimmed = content.trim();
        if (trimmed.startsWith('_') && trimmed.endsWith('_')) return trimmed;
        return '_' + trimmed + '_';
      },
    });

    let body_md = td.turndown(body_html || '');
    body_md = body_md.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\s*\n+/, '').replace(/\n+\s*$/, '');

    const text_len = body_md.length;
    const summary = (container.textContent || '').trim().slice(0, 200);
    const finalMetrics = computeMetrics(body_html);
    const qualityCheck = checkQuality(initialMetrics, finalMetrics, COLLECT_CONFIG.quality);

    return {
      success: true,
      data: {
        title, url, summary, body_md, body_html, images,
        formulas: formulas.map(f => ({ type: f.display ? 'blockMath' : 'inlineMath', latex: f.latex, originalFormat: f.originalFormat })),
        mermaid: mermaidBlocks.map(m => ({ code: m.code, diagramType: m.diagramType })),
        wordCount: text_len, imageCount: images.length, formulaCount: formulas.length, mermaidCount: mermaidBlocks.length,
        useHtmlFallback: !qualityCheck.pass, qualityCheck,
      },
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[content:collect] 采集异常:', errorMessage);
    return { success: false, error: errorMessage };
  }
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
            // If download was requested, trigger it from here (content script has DOM access)
            if (result.success && result.data?.body_md) {
              try {
                const { title, body_md } = result.data;
                const filename = `${sanitizeFilename(title || 'untitled')}.md`;
                const blob = new Blob([body_md], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
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
