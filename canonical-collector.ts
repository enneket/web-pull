/**
 * Canonical 内容采集器
 *
 * 架构：DOM → Canonical AST → 各格式输出
 *
 * 核心特点：
 * 1. 直接从 DOM 构建 AST，不经过 Markdown 中间层
 * 2. 图片、公式等资源在转换时收集到 AssetManifest
 * 3. 所有清洗操作在 AST 层完成
 * 4. Markdown 作为输出格式之一
 */

import { Readability } from '@mozilla/readability';
import {
  type RootNode,
  type CanonicalAssetManifest,
  domToCanonicalAst,
  serializeAst,
  standardCleanupPipeline,
} from './ast/pipeline';

export interface CanonicalCollectorOptions {
  baseUrl?: string;
  useReadability?: boolean;
  contentSelector?: string;
  cleanup?: boolean;
  preserveUnknownHtml?: boolean;
}

export interface CollectionResult {
  success: boolean;
  post?: CanonicalPost;
  content?: CanonicalContent;
  error?: string;
  metrics?: CollectionMetrics;
}

export interface CollectionMetrics {
  images: number;
  formulas: number;
  tables: number;
  codeBlocks: number;
  wordCount: number;
  processingTime: number;
}

export interface CanonicalPost {
  id: string;
  title: string;
  body_md: string;
  summary?: string;
  cover?: AssetRef;
  assets?: AssetRef[];
  source_url?: string;
  collected_at: string;
  createdAt: number;
  updatedAt: number;
  ast?: any;
  formulas?: any[];
  meta?: any;
}

export interface AssetRef {
  id: string;
  type: 'image' | 'formula';
  url: string;
  alt?: string;
  title?: string;
  width?: number;
  height?: number;
}

interface CanonicalContent {
  ast: RootNode;
  assets: CanonicalAssetManifest;
}

export class CanonicalCollector {
  private options: CanonicalCollectorOptions;

  constructor(options: CanonicalCollectorOptions = {}) {
    this.options = {
      useReadability: true,
      cleanup: true,
      preserveUnknownHtml: true,
      ...options,
    };
  }

  async collectFromHtml(
    html: string,
    url?: string
  ): Promise<CollectionResult> {
    const startTime = Date.now();

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      return this.collectFromDocument(doc, url, startTime);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '采集失败',
      };
    }
  }

  async collectFromDocument(
    doc: Document,
    url?: string,
    startTime?: number
  ): Promise<CollectionResult> {
    const start = startTime || Date.now();

    try {
      let contentElement: Element;
      let title = doc.title || '未命名';

      if (this.options.contentSelector) {
        const el = doc.querySelector(this.options.contentSelector);
        if (!el) {
          return { success: false, error: `未找到内容: ${this.options.contentSelector}` };
        }
        contentElement = el;
      } else if (this.options.useReadability) {
        const cloned = doc.cloneNode(true) as Document;
        const article = new Readability(cloned, {
          keepClasses: true,
          charThreshold: 100,
        }).parse();

        if (!article) {
          return { success: false, error: '无法提取文章内容' };
        }

        title = article.title || title;

        const container = doc.createElement('div');
        container.innerHTML = article.content;
        contentElement = container;
      } else {
        contentElement = doc.body;
      }

      const canonicalContent = domToCanonicalAst(contentElement, {
        baseUrl: url || this.options.baseUrl,
        preserveUnknownHtml: this.options.preserveUnknownHtml,
      });

      let ast = canonicalContent.ast;
      if (this.options.cleanup) {
        ast = standardCleanupPipeline(ast);
      }

      const bodyMd = serializeAst(ast, {
        format: 'markdown',
        assets: canonicalContent.assets,
      });

      const metrics = this.computeMetrics(ast, canonicalContent.assets, start);

      const post = this.buildCanonicalPost({
        title,
        ast,
        assets: canonicalContent.assets,
        bodyMd,
        url,
        metrics,
      });

      return {
        success: true,
        post,
        content: { ...canonicalContent, ast },
        metrics,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '采集失败',
      };
    }
  }

  async collectFromCurrentPage(): Promise<CollectionResult> {
    return this.collectFromDocument(document, window.location.href);
  }

  private computeMetrics(
    ast: RootNode,
    assets: CanonicalAssetManifest,
    startTime: number
  ): CollectionMetrics {
    let tables = 0;
    let codeBlocks = 0;
    let wordCount = 0;

    const countNodes = (nodes: any[]) => {
      for (const node of nodes) {
        if (node.type === 'table') tables++;
        if (node.type === 'codeBlock') codeBlocks++;
        if (node.type === 'text') {
          wordCount += (node.value || '').length;
        }
        if (node.children && Array.isArray(node.children)) {
          countNodes(node.children);
        }
      }
    };

    countNodes(ast.children);

    return {
      images: assets.images.length,
      formulas: assets.formulas.length,
      tables,
      codeBlocks,
      wordCount,
      processingTime: Date.now() - startTime,
    };
  }

  private buildCanonicalPost(params: {
    title: string;
    ast: RootNode;
    assets: CanonicalAssetManifest;
    bodyMd: string;
    url?: string;
    metrics: CollectionMetrics;
  }): CanonicalPost {
    const { title, ast, assets, bodyMd, url, metrics } = params;

    const assetRefs: AssetRef[] = assets.images.map(img => ({
      id: img.id,
      type: 'image' as const,
      url: img.originalUrl,
      alt: img.alt,
      title: img.title,
      width: img.width,
      height: img.height,
    }));

    const summary = this.extractSummary(ast, 200);

    const cover = assetRefs.length > 0 ? assetRefs[0] : undefined;

    const now = Date.now();

    return {
      id: this.generateId(),
      title,
      body_md: bodyMd,
      summary,
      cover,
      assets: assetRefs,
      source_url: url,
      collected_at: new Date().toISOString(),
      createdAt: now,
      updatedAt: now,
      ast: ast.children as any,
      formulas: assets.formulas.map(f => ({
        type: f.display ? 'blockMath' : 'inlineMath',
        latex: f.tex,
      })) as any,
      meta: {
        metrics,
        hasComplexTables: assets.images.some(img => img.id.startsWith('table-')),
      },
    };
  }

  private extractSummary(ast: RootNode, maxLength: number): string {
    const texts: string[] = [];

    const extractText = (nodes: any[]) => {
      for (const node of nodes) {
        if (texts.join('').length >= maxLength) break;

        if (node.type === 'text') {
          texts.push(node.value || '');
        }
        if (node.children && Array.isArray(node.children)) {
          extractText(node.children);
        }
      }
    };

    extractText(ast.children);

    let summary = texts.join('').trim();
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength) + '...';
    }

    return summary;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export async function collectHtml(
  html: string,
  options?: CanonicalCollectorOptions
): Promise<CollectionResult> {
  const collector = new CanonicalCollector(options);
  return collector.collectFromHtml(html);
}

export async function collectCurrentPage(
  options?: CanonicalCollectorOptions
): Promise<CollectionResult> {
  const collector = new CanonicalCollector(options);
  return collector.collectFromCurrentPage();
}
