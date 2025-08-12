// Popup script for AI Translation Extension

// DOM elements
const apiEndpointInput = document.getElementById('api-endpoint') as HTMLInputElement
const apiKeyInput = document.getElementById('api-key') as HTMLInputElement
const modelInput = document.getElementById('model') as HTMLInputElement
const targetLanguageInput = document.getElementById('target-language') as HTMLInputElement
const apiRpsInput = document.getElementById('api-rps') as HTMLInputElement
const batchSizeInput = document.getElementById('batch-size') as HTMLInputElement
const readabilityModeSelect = document.getElementById('readability-mode') as HTMLSelectElement
const charThresholdInput = document.getElementById('char-threshold') as HTMLInputElement
const charThresholdGroup = document.getElementById('char-threshold-group') as HTMLDivElement
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
    'batchSize',
    'readabilityMode',
    'charThreshold'
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
    apiRpsInput.value = '0.9' // Default to 0.9 RPS
  }
  if (settings.batchSize !== undefined) {
    batchSizeInput.value = settings.batchSize.toString()
  } else {
    batchSizeInput.value = '1000' // Default to 1000 characters
  }
  if (settings.readabilityMode !== undefined) {
    readabilityModeSelect.value = settings.readabilityMode
  } else {
    readabilityModeSelect.value = 'limited' // Default to limited mode
  }
  if (settings.charThreshold !== undefined) {
    charThresholdInput.value = settings.charThreshold.toString()
  } else {
    charThresholdInput.value = '500' // Default to 500 characters
  }
  
  // Show/hide char threshold based on mode
  toggleCharThresholdVisibility()
}

// Save settings
async function saveSettings() {
  const settings = {
    apiEndpoint: apiEndpointInput.value || 'https://api.openai.com/v1/chat/completions',
    apiKey: apiKeyInput.value,
    model: modelInput.value || 'gpt-4.1-nano',
    targetLanguage: targetLanguageInput.value || 'Japanese',
    apiRps: parseFloat(apiRpsInput.value) || 0.9,
    batchSize: parseInt(batchSizeInput.value) || 1000,
    readabilityMode: readabilityModeSelect.value as 'off' | 'limited' | 'overlay',
    charThreshold: parseInt(charThresholdInput.value) || 500
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

// Toggle char threshold visibility based on readability mode
function toggleCharThresholdVisibility() {
  const mode = readabilityModeSelect.value
  if (mode === 'off') {
    charThresholdGroup.style.display = 'none'
  } else {
    charThresholdGroup.style.display = 'block'
  }
}

// Event listeners
saveSettingsButton.addEventListener('click', saveSettings)
translateButton.addEventListener('click', handleTranslate)
restoreButton.addEventListener('click', handleRestore)
readabilityModeSelect.addEventListener('change', toggleCharThresholdVisibility)

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