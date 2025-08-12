// Content script for AI Translation Extension with Reader Mode Overlay

import { isReaderable, extractArticleForOverlay } from './readability-adapter'
import { translateText } from './api'
import { htmlToPlaceholders, placeholdersToHtml } from './utils'
import './overlay.css'

interface TranslationSettings {
  apiEndpoint: string
  apiKey: string
  model: string
  targetLanguage: string
  batchSize?: number
  readabilityMode?: boolean
}

// Overlay state
let overlayElement: HTMLElement | null = null
let isTranslating = false

// Create reader mode overlay
function createOverlay(): HTMLElement {
  const overlay = document.createElement('div')
  overlay.className = 'ai-translation-overlay'
  overlay.innerHTML = `
    <div class="ai-translation-overlay__controls">
      <button class="ai-translation-overlay__button ai-translation-overlay__button--secondary" id="overlay-toggle-theme">
        🌙 Dark
      </button>
      <button class="ai-translation-overlay__button ai-translation-overlay__close" id="overlay-close">
        ✕
      </button>
    </div>
    <div class="ai-translation-overlay__progress" style="display: none;">
      <div class="ai-translation-overlay__progress-bar" style="width: 0%;"></div>
    </div>
    <div class="ai-translation-overlay__container">
      <div class="ai-translation-overlay__loading">
        Extracting article content...
      </div>
    </div>
  `
  
  // Add event listeners
  const closeBtn = overlay.querySelector('#overlay-close')
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      removeOverlay()
    })
  }
  
  const themeBtn = overlay.querySelector('#overlay-toggle-theme')
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      overlay.classList.toggle('dark')
      const isDark = overlay.classList.contains('dark')
      themeBtn.textContent = isDark ? '☀️ Light' : '🌙 Dark'
    })
  }
  
  // Handle ESC key
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      removeOverlay()
    }
  }
  document.addEventListener('keydown', handleEsc)
  overlay.dataset.escListener = 'true'
  
  return overlay
}

// Remove overlay
function removeOverlay() {
  if (overlayElement) {
    overlayElement.remove()
    overlayElement = null
    // Restore body scroll
    document.body.style.overflow = ''
  }
}

// Update progress bar
function updateProgress(percent: number) {
  if (!overlayElement) return
  const progressBar = overlayElement.querySelector('.ai-translation-overlay__progress-bar') as HTMLElement
  const progressContainer = overlayElement.querySelector('.ai-translation-overlay__progress') as HTMLElement
  if (progressBar && progressContainer) {
    progressContainer.style.display = percent > 0 && percent < 100 ? 'block' : 'none'
    progressBar.style.width = `${percent}%`
  }
}

// Display article in overlay
async function displayArticleInOverlay(article: { content: string; title?: string; byline?: string }, settings: TranslationSettings) {
  if (!overlayElement) return
  
  const container = overlayElement.querySelector('.ai-translation-overlay__container')
  if (!container) return
  
  // Build article HTML
  let html = '<div class="ai-translation-overlay__header">'
  if (article.title) {
    html += `<h1 class="ai-translation-overlay__title">${article.title}</h1>`
  }
  if (article.byline) {
    html += `<div class="ai-translation-overlay__meta">${article.byline}</div>`
  }
  html += '</div>'
  html += `<div class="ai-translation-overlay__content">${article.content}</div>`
  
  container.innerHTML = html
  
  // Start translation
  updateProgress(10)
  await translateOverlayContent(settings)
  updateProgress(100)
  
  // Hide progress after completion
  setTimeout(() => updateProgress(0), 500)
}

// Translate overlay content
async function translateOverlayContent(settings: TranslationSettings) {
  if (!overlayElement) return
  
  const contentElement = overlayElement.querySelector('.ai-translation-overlay__content') as HTMLElement
  if (!contentElement) return
  
  // Get all paragraphs and headings
  const elements = contentElement.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote')
  const totalElements = elements.length
  let completed = 0
  
  // Translate each element
  for (const element of elements) {
    const html = element.innerHTML
    if (!html.trim()) continue
    
    // Convert to placeholders
    const { text: placeholderText, map } = htmlToPlaceholders(html)
    
    try {
      // Translate
      const response = await translateText({
        text: placeholderText,
        targetLanguage: settings.targetLanguage,
        apiEndpoint: settings.apiEndpoint,
        apiKey: settings.apiKey,
        model: settings.model
      })
      
      if (!response.error && response.translatedText) {
        // Restore HTML and apply
        const restoredHTML = placeholdersToHtml(response.translatedText, map)
        element.innerHTML = restoredHTML
      }
    } catch (error) {
      console.error('Translation error:', error)
    }
    
    completed++
    updateProgress(10 + (completed / totalElements) * 80)
  }
}

// Translate page with reader mode
async function translatePage(settings: TranslationSettings) {
  if (isTranslating) return { status: 'already_translating' }
  
  isTranslating = true
  
  try {
    // Check if reader mode is enabled
    if (settings.readabilityMode && isReaderable(document)) {
      // Extract article content
      const article = extractArticleForOverlay(document)
      
      if (article) {
        // Create and show overlay
        overlayElement = createOverlay()
        document.body.appendChild(overlayElement)
        
        // Prevent background scrolling
        document.body.style.overflow = 'hidden'
        
        // Display and translate article
        await displayArticleInOverlay(article, settings)
        
        chrome.runtime.sendMessage({ action: 'updateBadge', status: 'completed' })
        return { status: 'completed' }
      }
    }
    
    // Fallback: Show message that page is not suitable for reader mode
    showInfo('This page is not suitable for Reader Mode. Please try a different page with article content.')
    chrome.runtime.sendMessage({ action: 'updateBadge', status: 'error' })
    return { status: 'not_readable' }
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Translation failed'
    showError(message)
    chrome.runtime.sendMessage({ action: 'updateBadge', status: 'error' })
    return { status: 'error', message }
  } finally {
    isTranslating = false
  }
}

// Show info message
function showInfo(message: string) {
  const infoDiv = document.createElement('div')
  infoDiv.textContent = message
  infoDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #1a73e8;
    color: white;
    padding: 12px 24px;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    z-index: 9999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
  `
  document.body.appendChild(infoDiv)
  setTimeout(() => infoDiv.remove(), 5000)
}

// Show error message
function showError(message: string) {
  const errorDiv = document.createElement('div')
  errorDiv.textContent = message
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #d33c26;
    color: white;
    padding: 12px 24px;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    z-index: 9999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
  `
  document.body.appendChild(errorDiv)
  setTimeout(() => errorDiv.remove(), 5000)
}

// Restore page (close overlay)
function restorePage() {
  removeOverlay()
  chrome.runtime.sendMessage({ action: 'updateBadge', status: 'restored' })
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'translate') {
    // Get settings and translate
    chrome.storage.local.get([
      'apiEndpoint',
      'apiKey', 
      'model',
      'targetLanguage',
      'batchSize',
      'readabilityMode'
    ], (settings) => {
      translatePage(settings as TranslationSettings).then(sendResponse)
    })
    return true // Keep message channel open for async response
  } else if (request.action === 'restore') {
    restorePage()
    sendResponse({ status: 'restored' })
  }
})

// Export functions for testing
export { translatePage, restorePage }