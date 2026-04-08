<template>
  <div class="popup">
    <h1>page-to-md</h1>
    <button @click="extractAndDownload" :disabled="loading">
      {{ loading ? '提取中...' : '下载 Markdown' }}
    </button>
    <p v-if="status" :class="{ error: hasError }">{{ status }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { downloadMarkdown, sanitizeFilename } from '../../utils/download'

const loading = ref(false)
const status = ref('')
const hasError = ref(false)

async function extractAndDownload() {
  loading.value = true
  status.value = ''
  hasError.value = false

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab.id) {
      throw new Error('无法获取当前标签页')
    }

    const result = await chrome.tabs.sendMessage(tab.id, {
      type: 'EXTRACT_ARTICLE',
    })

    if (!result || !result.content_md) {
      throw new Error('提取失败，请确保在文章页面使用')
    }

    const filename = `${sanitizeFilename(result.title)}.md`
    const frontMatter = `---
title: "${result.title}"
author: "${result.author}"
source: ${result.source_url}
date: ${result.published_at}
---

`

    const fullContent = frontMatter + result.content_md
    downloadMarkdown(filename, fullContent)
    status.value = `已保存: ${filename}`
  } catch (error) {
    hasError.value = true
    status.value = error instanceof Error ? error.message : '未知错误'
  } finally {
    loading.value = false
  }
}
</script>

<style>
.popup {
  padding: 16px;
  min-width: 280px;
  font-family: system-ui, sans-serif;
}
h1 {
  font-size: 16px;
  margin: 0 0 12px;
}
button {
  width: 100%;
  padding: 10px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
button:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}
p {
  margin: 12px 0 0;
  font-size: 12px;
  word-break: break-all;
}
.error {
  color: #dc2626;
}
</style>
