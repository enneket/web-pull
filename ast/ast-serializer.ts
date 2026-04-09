/**
 * AST 序列化器
 * 将 Canonical AST 转换为 Markdown 或 HTML
 */

import type {
  RootNode,
  BlockNode,
  InlineNode,
  TextNode,
  ParagraphNode,
  HeadingNode,
  BlockquoteNode,
  ListNode,
  ListItemNode,
  CodeBlockNode,
  MermaidBlockNode,
  MathBlockNode,
  ThematicBreakNode,
  ImageBlockNode,
  TableNode,
  TableCellNode,
  HtmlBlockNode,
  EmbedBlockNode,
  EmphasisNode,
  StrongNode,
  DeleteNode,
  InlineCodeNode,
  LinkNode,
  ImageInlineNode,
  MathInlineNode,
  BreakNode,
  HtmlInlineNode,
  CanonicalAssetManifest,
} from './canonical-ast';

// ========== 序列化配置 ==========

export interface SerializeOptions {
  format: 'markdown' | 'html';
  assets?: CanonicalAssetManifest;
  platform?: string;
  imageUrlMap?: Map<string, string>;
  mathMode?: 'latex' | 'image' | 'html';
  complexTableMode?: 'html' | 'simplify' | 'image';
  bulletMarker?: '-' | '*' | '+';
  emphasisMarker?: '_' | '*';
}

const defaultOptions: SerializeOptions = {
  format: 'markdown',
  mathMode: 'latex',
  complexTableMode: 'html',
  bulletMarker: '-',
  emphasisMarker: '_',
};


// ========== 主序列化函数 ==========

export function serializeAst(
  ast: RootNode,
  options: Partial<SerializeOptions> = {}
): string {
  const opts = { ...defaultOptions, ...options };

  if (opts.format === 'html') {
    return serializeToHtml(ast, opts);
  } else {
    return serializeToMarkdown(ast, opts);
  }
}

// ========== Markdown 序列化 ==========

function serializeToMarkdown(ast: RootNode, opts: SerializeOptions): string {
  const lines: string[] = [];

  for (const node of ast.children) {
    const result = serializeBlockToMd(node, opts, 0);
    if (result) lines.push(result);
  }

  return lines.join('\n\n').trim();
}

function serializeBlockToMd(
  node: BlockNode,
  opts: SerializeOptions,
  depth: number
): string {
  switch (node.type) {
    case 'paragraph':
      return serializeParagraphToMd(node, opts);

    case 'heading':
      return serializeHeadingToMd(node, opts);

    case 'blockquote':
      return serializeBlockquoteToMd(node, opts, depth);

    case 'list':
      return serializeListToMd(node, opts, depth);

    case 'listItem':
      return serializeListItemToMd(node, opts, depth);

    case 'codeBlock':
      return serializeCodeBlockToMd(node, opts);

    case 'mermaidBlock':
      return serializeMermaidBlockToMd(node as MermaidBlockNode, opts);

    case 'mathBlock':
      return serializeMathBlockToMd(node, opts);

    case 'thematicBreak':
      return '---';

    case 'imageBlock':
      return serializeImageBlockToMd(node, opts);

    case 'table':
      return serializeTableToMd(node, opts);

    case 'htmlBlock':
      return node.value;

    case 'embedBlock':
      return serializeEmbedToMd(node, opts);

    default:
      return '';
  }
}

function serializeParagraphToMd(node: ParagraphNode, opts: SerializeOptions): string {
  return serializeInlinesToMd(node.children, opts);
}

function serializeHeadingToMd(node: HeadingNode, opts: SerializeOptions): string {
  const prefix = '#'.repeat(node.depth);
  const content = serializeInlinesToMd(node.children, opts);
  return `${prefix} ${content}`;
}

function serializeBlockquoteToMd(
  node: BlockquoteNode,
  opts: SerializeOptions,
  depth: number
): string {
  const lines: string[] = [];

  for (const child of node.children) {
    const content = serializeBlockToMd(child, opts, depth + 1);
    const prefixed = content.split('\n').map(line => `> ${line}`).join('\n');
    lines.push(prefixed);
  }

  return lines.join('\n>\n');
}

function serializeListToMd(
  node: ListNode,
  opts: SerializeOptions,
  depth: number
): string {
  const lines: string[] = [];
  const indent = '  '.repeat(depth);

  node.children.forEach((item, index) => {
    const marker = node.ordered
      ? `${(node.start || 1) + index}.`
      : opts.bulletMarker || '-';

    const content = serializeListItemContentToMd(item, opts, depth);
    const firstLine = content.split('\n')[0];
    const restLines = content.split('\n').slice(1);

    lines.push(`${indent}${marker} ${firstLine}`);

    if (restLines.length > 0) {
      const restIndent = '  '.repeat(depth + 1);
      lines.push(...restLines.map(line => `${restIndent}${line}`));
    }
  });

  return lines.join('\n');
}

function serializeListItemContentToMd(
  node: ListItemNode,
  opts: SerializeOptions,
  depth: number
): string {
  const parts: string[] = [];

  if (node.checked !== undefined && node.checked !== null) {
    parts.push(node.checked ? '[x]' : '[ ]');
  }

  for (const child of node.children) {
    parts.push(serializeBlockToMd(child, opts, depth + 1));
  }

  return parts.join(' ');
}

function serializeListItemToMd(
  node: ListItemNode,
  opts: SerializeOptions,
  depth: number
): string {
  return serializeListItemContentToMd(node, opts, depth);
}


function serializeCodeBlockToMd(node: CodeBlockNode, opts: SerializeOptions): string {
  const lang = node.lang || '';
  const meta = node.meta || '';
  const fence = '```';
  return `${fence}${lang}${meta ? ' ' + meta : ''}\n${node.value}\n${fence}`;
}

function serializeMermaidBlockToMd(node: MermaidBlockNode, opts: SerializeOptions): string {
  const fence = '```';
  return `${fence}mermaid\n${node.code}\n${fence}`;
}

function serializeMathBlockToMd(node: MathBlockNode, opts: SerializeOptions): string {
  if (opts.mathMode === 'latex') {
    return `$$\n${node.tex}\n$$`;
  }
  return `$$\n${node.tex}\n$$`;
}

function serializeImageBlockToMd(node: ImageBlockNode, opts: SerializeOptions): string {
  const url = resolveImageUrl(node.assetId, node.originalUrl, opts);
  const alt = node.alt || '';
  const title = node.title ? ` "${node.title}"` : '';

  let result = `![${alt}](${url}${title})`;

  if (node.caption && node.caption.length > 0) {
    const captionText = serializeInlinesToMd(node.caption, opts);
    result += `\n*${captionText}*`;
  }

  return result;
}

function serializeTableToMd(node: TableNode, opts: SerializeOptions): string {
  if (node.hasRowspan || node.hasColspan) {
    if (opts.complexTableMode === 'html') {
      return serializeTableToHtml(node, opts);
    }
  }

  const lines: string[] = [];
  const colCount = node.children[0]?.children.length || 0;

  const headerRow = node.children[0];
  if (headerRow) {
    const cells = headerRow.children.map(cell =>
      serializeInlinesToMd(cell.children, opts)
    );
    lines.push(`| ${cells.join(' | ')} |`);

    const alignRow = (node.align || []).map((align, i) => {
      if (align === 'left') return ':---';
      if (align === 'right') return '---:';
      if (align === 'center') return ':---:';
      return '---';
    });
    while (alignRow.length < colCount) alignRow.push('---');
    lines.push(`| ${alignRow.join(' | ')} |`);
  }

  for (let i = 1; i < node.children.length; i++) {
    const row = node.children[i];
    const cells = row.children.map(cell =>
      serializeInlinesToMd(cell.children, opts)
    );
    lines.push(`| ${cells.join(' | ')} |`);
  }

  return lines.join('\n');
}

function serializeEmbedToMd(node: EmbedBlockNode, opts: SerializeOptions): string {
  if (node.url) {
    const label = node.provider || node.embedType || 'embed';
    return `[${label}](${node.url})`;
  }

  if (node.html) {
    return node.html;
  }

  return '';
}


// ========== 内联节点 Markdown 序列化 ==========

function serializeInlinesToMd(nodes: InlineNode[], opts: SerializeOptions): string {
  return nodes.map(node => serializeInlineToMd(node, opts)).join('');
}

function serializeInlineToMd(node: InlineNode, opts: SerializeOptions): string {
  switch (node.type) {
    case 'text':
      return escapeMarkdown(node.value);

    case 'emphasis': {
      const marker = opts.emphasisMarker || '_';
      const content = serializeInlinesToMd((node as EmphasisNode).children, opts);
      return `${marker}${content}${marker}`;
    }

    case 'strong': {
      const content = serializeInlinesToMd((node as StrongNode).children, opts);
      return `**${content}**`;
    }

    case 'delete': {
      const content = serializeInlinesToMd((node as DeleteNode).children, opts);
      return `~~${content}~~`;
    }

    case 'inlineCode':
      return `\`${(node as InlineCodeNode).value}\``;

    case 'link': {
      const n = node as LinkNode;
      const content = serializeInlinesToMd(n.children, opts);
      const title = n.title ? ` "${n.title}"` : '';
      return `[${content}](${n.url}${title})`;
    }

    case 'imageInline': {
      const n = node as ImageInlineNode;
      const url = resolveImageUrl(n.assetId, n.originalUrl, opts);
      const alt = n.alt || '';
      const title = n.title ? ` "${n.title}"` : '';
      return `![${alt}](${url}${title})`;
    }

    case 'mathInline':
      if (opts.mathMode === 'latex') {
        return `$${(node as MathInlineNode).tex}$`;
      }
      return `$${(node as MathInlineNode).tex}$`;

    case 'break':
      return '  \n';

    case 'htmlInline':
      return (node as HtmlInlineNode).value;

    case 'footnoteRef':
      return `[^${(node as any).identifier}]`;

    default:
      return '';
  }
}

function escapeMarkdown(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ========== HTML 序列化 ==========

function serializeToHtml(ast: RootNode, opts: SerializeOptions): string {
  const parts: string[] = [];

  for (const node of ast.children) {
    const result = serializeBlockToHtml(node, opts);
    if (result) parts.push(result);
  }

  return parts.join('\n');
}

function serializeBlockToHtml(node: BlockNode, opts: SerializeOptions): string {
  switch (node.type) {
    case 'paragraph':
      return `<p>${serializeInlinesToHtml((node as ParagraphNode).children, opts)}</p>`;

    case 'heading': {
      const n = node as HeadingNode;
      return `<h${n.depth}>${serializeInlinesToHtml(n.children, opts)}</h${n.depth}>`;
    }

    case 'blockquote': {
      const n = node as BlockquoteNode;
      const content = n.children.map(c => serializeBlockToHtml(c, opts)).join('\n');
      return `<blockquote>\n${content}\n</blockquote>`;
    }

    case 'list': {
      const n = node as ListNode;
      const tag = n.ordered ? 'ol' : 'ul';
      const start = n.ordered && n.start !== 1 ? ` start="${n.start}"` : '';
      const items = n.children.map(item => {
        const content = item.children.map(c => serializeBlockToHtml(c, opts)).join('\n');
        const checkbox = item.checked !== undefined && item.checked !== null
          ? `<input type="checkbox"${item.checked ? ' checked' : ''} disabled> `
          : '';
        return `<li>${checkbox}${content}</li>`;
      }).join('\n');
      return `<${tag}${start}>\n${items}\n</${tag}>`;
    }

    case 'codeBlock': {
      const n = node as CodeBlockNode;
      const lang = n.lang ? ` class="language-${n.lang}"` : '';
      const escaped = escapeHtml(n.value);
      return `<pre><code${lang}>${escaped}</code></pre>`;
    }

    case 'mermaidBlock': {
      const n = node as MermaidBlockNode;
      return `<pre class="mermaid">${escapeHtml(n.code)}</pre>`;
    }

    case 'mathBlock':
      return `<div class="math-block">$$${escapeHtml((node as MathBlockNode).tex)}$$</div>`;

    case 'thematicBreak':
      return '<hr>';

    case 'imageBlock': {
      const n = node as ImageBlockNode;
      const url = resolveImageUrl(n.assetId, n.originalUrl, opts);
      const alt = n.alt ? ` alt="${escapeHtml(n.alt)}"` : '';
      const title = n.title ? ` title="${escapeHtml(n.title)}"` : '';
      let html = `<figure><img src="${url}"${alt}${title}>`;
      if (n.caption && n.caption.length > 0) {
        html += `<figcaption>${serializeInlinesToHtml(n.caption, opts)}</figcaption>`;
      }
      html += '</figure>';
      return html;
    }

    case 'table':
      return serializeTableToHtml(node as TableNode, opts);

    case 'htmlBlock':
      return (node as HtmlBlockNode).value;

    case 'embedBlock': {
      const n = node as EmbedBlockNode;
      return n.html || `<a href="${n.url || ''}">${n.provider || 'embed'}</a>`;
    }

    default:
      return '';
  }
}


function serializeTableToHtml(node: TableNode, opts: SerializeOptions): string {
  const lines: string[] = ['<table>'];

  if (node.caption && node.caption.length > 0) {
    lines.push(`<caption>${serializeInlinesToHtml(node.caption, opts)}</caption>`);
  }

  const headerRows: typeof node.children = [];
  const bodyRows: typeof node.children = [];

  for (const row of node.children) {
    const isHeader = row.children.every(cell => cell.header);
    if (isHeader && bodyRows.length === 0) {
      headerRows.push(row);
    } else {
      bodyRows.push(row);
    }
  }

  if (headerRows.length > 0) {
    lines.push('<thead>');
    for (const row of headerRows) {
      lines.push(serializeTableRowToHtml(row, opts, true));
    }
    lines.push('</thead>');
  }

  if (bodyRows.length > 0) {
    lines.push('<tbody>');
    for (const row of bodyRows) {
      lines.push(serializeTableRowToHtml(row, opts, false));
    }
    lines.push('</tbody>');
  }

  lines.push('</table>');
  return lines.join('\n');
}

function serializeTableRowToHtml(
  row: { type: 'tableRow'; children: TableCellNode[] },
  opts: SerializeOptions,
  isHeader: boolean
): string {
  const cells = row.children.map(cell => {
    const tag = cell.header || isHeader ? 'th' : 'td';
    const attrs: string[] = [];

    if (cell.rowspan && cell.rowspan > 1) attrs.push(`rowspan="${cell.rowspan}"`);
    if (cell.colspan && cell.colspan > 1) attrs.push(`colspan="${cell.colspan}"`);
    if (cell.align) attrs.push(`style="text-align: ${cell.align}"`);

    const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
    const content = serializeInlinesToHtml(cell.children, opts);

    return `<${tag}${attrStr}>${content}</${tag}>`;
  }).join('');

  return `<tr>${cells}</tr>`;
}

function serializeInlinesToHtml(nodes: InlineNode[], opts: SerializeOptions): string {
  return nodes.map(node => serializeInlineToHtml(node, opts)).join('');
}

function serializeInlineToHtml(node: InlineNode, opts: SerializeOptions): string {
  switch (node.type) {
    case 'text':
      return escapeHtml((node as TextNode).value);

    case 'emphasis':
      return `<em>${serializeInlinesToHtml((node as EmphasisNode).children, opts)}</em>`;

    case 'strong':
      return `<strong>${serializeInlinesToHtml((node as StrongNode).children, opts)}</strong>`;

    case 'delete':
      return `<del>${serializeInlinesToHtml((node as DeleteNode).children, opts)}</del>`;

    case 'inlineCode':
      return `<code>${escapeHtml((node as InlineCodeNode).value)}</code>`;

    case 'link': {
      const n = node as LinkNode;
      const title = n.title ? ` title="${escapeHtml(n.title)}"` : '';
      return `<a href="${n.url}"${title}>${serializeInlinesToHtml(n.children, opts)}</a>`;
    }

    case 'imageInline': {
      const n = node as ImageInlineNode;
      const url = resolveImageUrl(n.assetId, n.originalUrl, opts);
      const alt = n.alt ? ` alt="${escapeHtml(n.alt)}"` : '';
      const title = n.title ? ` title="${escapeHtml(n.title)}"` : '';
      return `<img src="${url}"${alt}${title}>`;
    }

    case 'mathInline':
      return `<span class="math-inline">$${escapeHtml((node as MathInlineNode).tex)}$</span>`;

    case 'break':
      return '<br>';

    case 'htmlInline':
      return (node as HtmlInlineNode).value;

    default:
      return '';
  }
}

// ========== 辅助函数 ==========

function resolveImageUrl(
  assetId: string,
  originalUrl: string | undefined,
  opts: SerializeOptions
): string {
  if (opts.imageUrlMap?.has(assetId)) {
    return opts.imageUrlMap.get(assetId)!;
  }

  if (opts.assets) {
    const asset = opts.assets.images.find(img => img.id === assetId);
    if (asset) {
      if (asset.uploadedUrls && opts.platform && asset.uploadedUrls[opts.platform]) {
        return asset.uploadedUrls[opts.platform];
      }
      if (asset.proxyUrl) return asset.proxyUrl;
      return asset.originalUrl;
    }
  }

  return originalUrl || '';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
