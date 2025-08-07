// Background script for AI Translation Extension

chrome.runtime.onInstalled.addListener(() => {
  // Create context menu item
  chrome.contextMenus.create({
    id: 'translate-page',
    title: 'Translate this page',
    contexts: ['page'],
  })
})

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'translate-page' && tab?.id) {
    // Send message to content script to start translation
    chrome.tabs.sendMessage(tab.id, { action: 'translate' })
  }
})

// Handle messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, _sendResponse) => {
  if (request.action === 'translate' && sender.tab?.id) {
    // Forward translate request to content script
    chrome.tabs.sendMessage(sender.tab.id, { action: 'translate' })
  } else if (request.action === 'updateBadge' && sender.tab?.id) {
    // Update extension badge based on translation status
    const tabId = sender.tab.id
    
    switch (request.status) {
      case 'translating':
        chrome.action.setBadgeText({ text: '...', tabId })
        chrome.action.setBadgeBackgroundColor({ color: '#1a73e8', tabId })
        break
      case 'error':
        chrome.action.setBadgeText({ text: '!', tabId })
        chrome.action.setBadgeBackgroundColor({ color: '#d33c26', tabId })
        break
      case 'completed':
        chrome.action.setBadgeText({ text: '', tabId })
        break
    }
  }
  
  // Return true to indicate async response
  return true
})

export {}