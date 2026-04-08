export default defineBackground(() => {
  chrome.action.onClicked.addListener(async (tab) => {
    if (!tab?.id || !tab.url?.startsWith('http')) {
      chrome.tabs.sendMessage(tab.id, { type: 'SHOW_NOTIFICATION', text: '请在网页页面使用' });
      return;
    }

    try {
      // Try to get content from content script
      let response: any;
      try {
        response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_ARTICLE' });
      } catch {
        // Content script not injected, inject and retry
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-scripts/content.js'],
        });
        await new Promise(r => setTimeout(r, 200));
        response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_ARTICLE' });
      }

      if (response.error) throw new Error(response.error);
      if (!response.success) throw new Error(response.error || '采集失败');

      const data = response.data || response;
      const { title, body_md } = data;
      if (!body_md) throw new Error('提取失败');

      const filename = `${sanitizeFilename(title)}.md`;
      const blob = new Blob([body_md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      // Show success via badge
      chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e', tabId: tab.id });
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '', tabId: tab.id });
      }, 2000);

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      chrome.action.setBadgeText({ text: '✗', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444', tabId: tab.id });
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '', tabId: tab.id });
      }, 2000);
      console.error('[background] Download failed:', msg);
    }
  });
});

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '-').slice(0, 200) || 'untitled';
}
