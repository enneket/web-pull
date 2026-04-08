export async function ensureContentScriptLoaded(
  tabId: number,
): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' })
    return true
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/content.js'],
      })
      return true
    } catch {
      return false
    }
  }
}
