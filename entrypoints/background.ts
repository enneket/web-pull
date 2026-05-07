export default defineBackground(() => {
  chrome.action.onClicked.addListener(async (tab) => {
    if (!tab?.id) return;

    if (!tab.url?.startsWith('http')) {
      badge(tab.id, '✗', '#ef4444');
      return;
    }

    try {
      // Always inject first — idempotent via __webpull_loaded guard
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-scripts/content.js'],
      });

      // Now send message — content script is guaranteed to be ready
      const response: any = await sendMessage(tab.id, { type: 'EXTRACT_ARTICLE' });

      if (response?.error) {
        throw new Error(response.error);
      }
      if (!response?.success) {
        throw new Error(response?.error || '采集失败');
      }

      badge(tab.id, '✓', '#22c55e');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[background]', msg);
      badge(tab.id, '✗', '#ef4444');
    }
  });
});

// Helper to send message with callback-style error handling
function sendMessage(tabId: number, message: object): Promise<any> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ error: chrome.runtime.lastError.message });
      } else {
        resolve(response);
      }
    });
  });
}

function badge(tabId: number, text: string, color: string) {
  chrome.action.setBadgeText({ text, tabId });
  chrome.action.setBadgeBackgroundColor({ color, tabId });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '', tabId });
  }, 2000);
}
