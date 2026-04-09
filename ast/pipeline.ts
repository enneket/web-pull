/**
 * AST Pipeline - 统一导出
 */

// Types
export type {
  RootNode,
  BlockNode,
  InlineNode,
  CanonicalNode,
  CanonicalContent,
  CanonicalAssetManifest,
  ImageAssetEntry,
  FormulaAssetEntry,
  Position,
  BaseNode,
  // Block nodes
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
  TableRowNode,
  TableCellNode,
  TableAlign,
  HtmlBlockNode,
  EmbedBlockNode,
  FootnoteDefNode,
  TocNode,
  FrontmatterNode,
  CustomBlockNode,
  // Inline nodes
  TextNode,
  EmphasisNode,
  StrongNode,
  DeleteNode,
  InlineCodeNode,
  LinkNode,
  ImageInlineNode,
  MathInlineNode,
  BreakNode,
  HtmlInlineNode,
  FootnoteRefNode,
} from './canonical-ast';

export {
  isInlineNode,
  isBlockNode,
  isRootNode,
} from './canonical-ast';

// DOM to AST
export {
  domToCanonicalAst,
  htmlToCanonicalAst,
  type DomToAstOptions,
  type ElementHandler,
  ConversionContext,
} from './dom-to-ast';

// AST Transformer
export {
  visitAst,
  cleanAst,
  removeToc,
  removeAds,
  extractImageAssetIds,
  replaceImageUrls,
  convertMathToImage,
  composeTransformers,
  standardCleanupPipeline,
  type NodeVisitor,
  type BlockVisitor,
  type InlineVisitor,
  type AstTransformer,
} from './ast-transformer';

// Serializer
export {
  serializeAst,
  type SerializeOptions,
} from './ast-serializer';
