<template>
  <div class="popup">
    <h1>page-to-md</h1>
    <button @click="download" :disabled="loading">
      {{ loading ? '处理中...' : '下载 Markdown' }}
    </button>
    <p v-if="msg">{{ msg }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { sanitizeFilename } from '../../utils/download'

const loading = ref(false)
const msg = ref('')

async function download() {
  loading.value = true
  msg.value = ''

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url?.startsWith('http')) {
    msg.value = '请在网页页面使用'
    loading.value = false
    return
  }

  try {
    let res: any
    try {
      // First try - content script already injected
      res = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_ARTICLE' })
    } catch (_) {
      // Content script not injected yet - inject it dynamically
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-scripts/content.js'],
      })
      // Wait for injection to complete
      await new Promise(r => setTimeout(r, 200))
      res = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_ARTICLE' })
    }

    if (res.error) throw new Error(res.error)

    const { title, content_md } = res
    if (!content_md) throw new Error('提取失败')

    const filename = `${sanitizeFilename(title)}.md`
    const blob = new Blob([content_md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)

    msg.value = `已保存: ${filename}`
  } catch (e) {
    msg.value = String(e)
  } finally {
    loading.value = false
  }
}
</script>

<style>
.popup { padding: 16px; min-width: 260px; font-family: system-ui; }
h1 { font-size: 16px; margin: 0 0 12px; }
button { width: 100%; padding: 10px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; }
button:disabled { background: #93c5fd; }
p { margin: 12px 0 0; font-size: 12px; word-break: break-all; }
</style>
