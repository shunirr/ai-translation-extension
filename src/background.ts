// Background script for AI Translation Extension

import { configureApi } from './api'

// Helper function to get language display name
function getLanguageDisplayName(languageCode: string): string {
  const languageNames: Record<string, string> = {
    'ja': 'Japanese',
    'en': 'English',
    'ko': 'Korean',
    'zh': 'Chinese',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ar': 'Arabic',
    'hi': 'Hindi'
  }
  return languageNames[languageCode] || languageCode
}

// Helper function to update context menu title
async function updateContextMenuTitle() {
  const settings = await chrome.storage.local.get(['targetLanguage'])
  const targetLanguage = settings.targetLanguage || 'ja'
  const languageName = getLanguageDisplayName(targetLanguage)
  
  // Update the context menu
  chrome.contextMenus.update('translate-page', {
    title: `AI Translation: ${languageName}`
  })
}

chrome.runtime.onInstalled.addListener(async () => {
  // Initialize API with saved RPS setting
  const settings = await chrome.storage.local.get(['apiRps', 'targetLanguage'])
  configureApi({ rps: settings.apiRps || 0.5 })
  
  // Create context menu item with dynamic title
  const targetLanguage = settings.targetLanguage || 'ja'
  const languageName = getLanguageDisplayName(targetLanguage)
  
  chrome.contextMenus.create({
    id: 'translate-page',
    title: `AI Translation: ${languageName}`,
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

// Listen for storage changes to update RPS and context menu
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.apiRps) {
      configureApi({ rps: changes.apiRps.newValue || 0.5 })
    }
    if (changes.targetLanguage) {
      // Update context menu title when language changes
      updateContextMenuTitle()
    }
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