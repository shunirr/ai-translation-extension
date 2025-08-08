// Popup script for AI Translation Extension

// DOM elements
const apiEndpointInput = document.getElementById('api-endpoint') as HTMLInputElement
const apiKeyInput = document.getElementById('api-key') as HTMLInputElement
const modelInput = document.getElementById('model') as HTMLInputElement
const targetLanguageInput = document.getElementById('target-language') as HTMLInputElement
const apiRpsInput = document.getElementById('api-rps') as HTMLInputElement
const viewportTranslationCheckbox = document.getElementById('viewport-translation') as HTMLInputElement
const saveSettingsButton = document.getElementById('save-settings') as HTMLButtonElement
const translateButton = document.getElementById('translate-page') as HTMLButtonElement
const restoreButton = document.getElementById('restore-page') as HTMLButtonElement
const statusDiv = document.getElementById('status') as HTMLDivElement

// Load saved settings
async function loadSettings() {
  const settings = await chrome.storage.local.get([
    'apiEndpoint',
    'apiKey',
    'model',
    'targetLanguage',
    'apiRps',
    'viewportTranslation'
  ])
  
  if (settings.apiEndpoint) {
    apiEndpointInput.value = settings.apiEndpoint
  }
  if (settings.apiKey) {
    apiKeyInput.value = settings.apiKey
  }
  if (settings.model) {
    modelInput.value = settings.model
  }
  if (settings.targetLanguage) {
    targetLanguageInput.value = settings.targetLanguage
  }
  if (settings.apiRps !== undefined) {
    apiRpsInput.value = settings.apiRps.toString()
  } else {
    apiRpsInput.value = '1' // Default to 1 RPS
  }
  if (settings.viewportTranslation !== undefined) {
    viewportTranslationCheckbox.checked = settings.viewportTranslation
  } else {
    viewportTranslationCheckbox.checked = true // Default to true
  }
}

// Save settings
async function saveSettings() {
  const settings = {
    apiEndpoint: apiEndpointInput.value || 'https://api.openai.com/v1/chat/completions',
    apiKey: apiKeyInput.value,
    model: modelInput.value || 'gpt-4.1-nano',
    targetLanguage: targetLanguageInput.value || 'Japanese',
    apiRps: parseFloat(apiRpsInput.value) || 1,
    viewportTranslation: viewportTranslationCheckbox.checked
  }
  
  await chrome.storage.local.set(settings)
  showStatus('Settings saved successfully', 'success')
}

// Show status message
function showStatus(message: string, type: 'success' | 'error' | 'info') {
  statusDiv.textContent = message
  statusDiv.className = `status ${type}`
  
  setTimeout(() => {
    statusDiv.className = 'status'
  }, 3000)
}

// Handle translate button click
async function handleTranslate() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'translate' })
    showStatus('Translation started...', 'info')
    window.close()
  }
}

// Handle restore button click
async function handleRestore() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'restore' })
    showStatus('Page restored', 'success')
    window.close()
  }
}

// Event listeners
saveSettingsButton.addEventListener('click', saveSettings)
translateButton.addEventListener('click', handleTranslate)
restoreButton.addEventListener('click', handleRestore)

// Make click handlers available for testing
declare global {
  interface HTMLButtonElement {
    click?: () => void
  }
}

if (saveSettingsButton) {
  saveSettingsButton.click = saveSettings
}
if (translateButton) {
  translateButton.click = handleTranslate
}
if (restoreButton) {
  restoreButton.click = handleRestore
}

// Load settings on popup open
loadSettings()

export {}