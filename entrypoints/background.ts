export default defineBackground(() => {
  chrome.action.onClicked.addListener(async (tab) => {
    console.log('[background] Icon clicked, tab:', tab?.id, tab?.url);

    if (!tab?.id) {
      console.error('[background] No tab id');
      return;
    }

    if (!tab.url?.startsWith('http')) {
      console.error('[background] Not a http page:', tab.url);
      badge(tab.id, '✗', '#ef4444');
      return;
    }

    try {
      console.log('[background] Sending message to tab', tab.id);

      // First try: content script already injected
      let response: any = await sendMessage(tab.id, { type: 'EXTRACT_ARTICLE' });
      console.log('[background] First attempt response:', response);

      // If content script not loaded, inject and wait for it to be ready
      if (!response || response.error) {
        console.log('[background] Content script not ready, injecting...');
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content-scripts/content.js'],
          });
        } catch (e) {
          console.error('[background] executeScript failed:', e);
        }

        // Wait for content script to initialize
        console.log('[background] Waiting for content script to initialize...');
        let retries = 10;
        while (retries-- > 0) {
          await new Promise(r => setTimeout(r, 200));
          response = await sendMessage(tab.id, { type: 'EXTRACT_ARTICLE' });
          console.log('[background] Retry response:', response ? 'received' : 'null', 'retries left:', retries);
          if (response && !response.error) break;
        }
        console.log('[background] Final response:', response);
      }

      if (response?.error) {
        throw new Error(response.error);
      }
      if (!response?.success) {
        throw new Error(response?.error || '采集失败');
      }

      console.log('[background] Success!');
      badge(tab.id, '✓', '#22c55e');

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[background] Error:', msg);
      badge(tab.id, '✗', '#ef4444');
    }
  });
});

// Helper to send message with callback-style error handling
function sendMessage(tabId: number, message: object): Promise<any> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[background] sendMessage error:', chrome.runtime.lastError.message);
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
