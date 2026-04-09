# WebPull

一键采集任意网页为 Markdown，支持代码块、公式、Mermaid、图片自动提取。

## 功能特性

- **一键采集**：点击扩展图标，直接下载当前页面为 `.md` 文件
- **智能解析**：基于 Canonical AST 架构，DOM → AST → Markdown 无损转换
- **多平台支持**：自动识别 CSDN、知乎、掘金等平台专用选择器
- **内容完整**：
  - 代码块保留语法高亮标记
  - LaTeX 数学公式（KaTeX/MathJax）保留
  - Mermaid 图表源码保留
  - 表格结构完整保留
  - 图片 URL 自动归一化
- **无需登录**：纯本地采集，不上传任何数据

## 支持的平台

| 平台 | 支持状态 |
|:----:|:--------:|
| CSDN | ✅ |
| 知乎 | ✅ |
| 掘金 | ✅ |
| 通用网页 | ✅ (Readability 兜底) |

## 安装

### 方式一：下载预构建包（推荐）

1. 下载 `dist/web-pull-1.0.0-chrome.zip`
2. 解压到任意目录
3. 打开 Chrome，访问 `chrome://extensions/`
4. 开启右上角的 **开发者模式**
5. 点击 **加载已解压的扩展程序**
6. 选择解压后的文件夹

### 方式二：从源码构建

```bash
# 克隆仓库
git clone https://github.com/enneket/web-pull.git
cd web-pull

# 安装依赖
npm install

# 构建
npm run build
```

## 使用方法

1. 安装扩展后，在 Chrome 工具栏点击 WebPull 图标
2. 页面内容将自动采集并下载为 Markdown 文件
3. 文件名即为页面标题

## 技术架构

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│     DOM     │ ──► │ Canonical AST │ ──► │   Markdown    │
└─────────────┘     └──────────────┘     └───────────────┘
                           │
                    ┌──────┴──────┐
                    │   Assets   │
                    │ 图片/公式   │
                    └────────────┘
```

基于 [SyncCaster](https://github.com/RyanYipeng/SyncCaster) 的 Canonical AST 架构开发。

## 项目结构

```
web-pull/
├── ast/                    # AST 模块
│   ├── canonical-ast.ts   # AST 类型定义
│   ├── dom-to-ast.ts      # DOM → AST 转换器
│   ├── ast-transformer.ts # AST 转换管道
│   ├── ast-serializer.ts  # AST 序列化器
│   └── pipeline.ts        # 统一导出
├── entrypoints/
│   ├── content.ts         # Content Script 入口
│   └── background.ts      # Background Script
├── canonical-collector.ts  # 采集器封装
└── wxt.config.ts         # WXT 配置
```

## 开发

```bash
npm run dev    # 开发模式（热更新）
npm run build  # 生产构建
npm run zip    # 打包 ZIP
```

## License

MIT
