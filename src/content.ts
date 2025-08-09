// Content script for AI Translation Extension

import { translateElement, getTranslatableElements } from './element-translator'
import { BatchTranslator } from './batch-translator'

interface TranslationSettings {
  apiEndpoint: string
  apiKey: string
  model: string
  targetLanguage: string
  viewportTranslation?: boolean
  batchSize?: number
}

// Translation state
let isTranslating = false
let progressIndicator: HTMLElement | null = null
let translationObserver: IntersectionObserver | null = null
let translatedElements = new WeakSet<Element>()
const pendingTranslations = new Map<Element, () => Promise<void>>()

// Create progress indicator
function createProgressIndicator(): HTMLElement {
  const indicator = document.createElement('div')
  indicator.className = 'translation-progress'
  indicator.textContent = 'Translating...'
  indicator.style.cssText = `
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
  return indicator
}

// Show progress indicator
function showProgress() {
  if (!progressIndicator) {
    progressIndicator = createProgressIndicator()
    document.body.appendChild(progressIndicator)
  }
}

// Hide progress indicator
function hideProgress() {
  if (progressIndicator) {
    progressIndicator.remove()
    progressIndicator = null
  }
}

// Show error message
function showError(message: string) {
  hideProgress()
  const errorDiv = document.createElement('div')
  errorDiv.className = 'translation-error'
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

// Create intersection observer for viewport-based translation
function createTranslationObserver(_settings: TranslationSettings): IntersectionObserver {
  return new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !translatedElements.has(entry.target)) {
          const translateFunc = pendingTranslations.get(entry.target)
          if (translateFunc) {
            translateFunc()
            pendingTranslations.delete(entry.target)
          }
        }
      })
    },
    {
      rootMargin: '50px', // Start translating 50px before element comes into view
      threshold: 0.1
    }
  )
}

// Translate the page (viewport-based)
async function translatePage() {
  console.log('[Content] translatePage called')
  if (isTranslating) {
    console.log('[Content] Already translating, skipping')
    return { status: 'already_translating', message: 'Translation already in progress' }
  }

  isTranslating = true
  showProgress()
  
  console.log('[Content] Sending updateBadge message')
  // Update badge to show translation in progress
  chrome.runtime.sendMessage({ action: 'updateBadge', status: 'translating' })

  try {
    // Get settings from storage
    const storageData = await chrome.storage.local.get([
      'apiEndpoint',
      'apiKey',
      'model',
      'targetLanguage',
      'viewportTranslation',
      'batchSize'
    ])

    if (!storageData.apiKey) {
      throw new Error('API key not configured. Please set it in the extension popup.')
    }

    const settings: TranslationSettings = {
      apiEndpoint: storageData.apiEndpoint || 'https://api.openai.com/v1/chat/completions',
      apiKey: storageData.apiKey,
      model: storageData.model || 'gpt-4.1-nano',
      targetLanguage: storageData.targetLanguage || 'Japanese',
      viewportTranslation: storageData.viewportTranslation,
      batchSize: storageData.batchSize || 2000
    }

    // Clean up existing observer
    if (translationObserver) {
      translationObserver.disconnect()
    }

    // Check if viewport-based translation is enabled (default: true for large pages)
    const pageSize = document.body.textContent?.length || 0
    const useViewportTranslation = settings.viewportTranslation !== false || pageSize > 50000

    if (useViewportTranslation) {
      // Set up intersection observer for viewport-based translation
      translationObserver = createTranslationObserver(settings)
      
      let observedCount = 0
      
      // Get translatable elements and set up observers
      const translatableElements = getTranslatableElements()
      console.log('[Content] Found', translatableElements.length, 'translatable elements')
      
      translatableElements.forEach(element => {
        // Create translation function
        pendingTranslations.set(element, async () => {
          try {
            await translateElement(element, settings)
            translatedElements.add(element)
          } catch (error) {
            console.error('Translation error for element:', error)
          }
        })
        
        // Observe element
        translationObserver!.observe(element)
        observedCount++
      })
      
      // Translate visible elements immediately
      const visibleElements = translatableElements.filter(el => {
        const rect = el.getBoundingClientRect()
        return rect.top < window.innerHeight && rect.bottom > 0
      })
      console.log('[Content] Found', visibleElements.length, 'visible elements')
      
      // Use batch translator for visible elements
      const batchTranslator = new BatchTranslator({
        maxCharactersPerBatch: settings.batchSize
      })
      console.log('[Content] Created BatchTranslator with max', settings.batchSize, 'characters per batch')
      
      // Update progress
      if (progressIndicator) {
        progressIndicator.textContent = `Translating visible content... (${visibleElements.length} elements)`
      }
      
      console.log('[Content] Starting batch translation')
      await batchTranslator.translateElements(visibleElements, settings)
      
      // Mark translated elements
      visibleElements.forEach(element => {
        translatedElements.add(element)
        pendingTranslations.delete(element)
      })
      
      hideProgress()
      
      // Show info about viewport translation
      if (observedCount > visibleElements.length) {
        showInfo(`Translated ${visibleElements.length} visible elements. ${observedCount - visibleElements.length} more will translate as you scroll.`)
      }
      
      chrome.runtime.sendMessage({ action: 'updateBadge', status: 'completed' })
      return { status: 'completed', translatedCount: visibleElements.length, totalElements: observedCount }
      
    } else {
      // Full-page translation using batch translator
      const translatableElements = getTranslatableElements()
      
      if (translatableElements.length === 0) {
        throw new Error('No translatable content found on this page')
      }

      // Use batch translator
      const batchTranslator = new BatchTranslator({
        maxCharactersPerBatch: settings.batchSize
      })
      
      if (progressIndicator) {
        progressIndicator.textContent = `Translating... (${translatableElements.length} elements)`
      }

      await batchTranslator.translateElements(translatableElements, settings)

      hideProgress()
      chrome.runtime.sendMessage({ action: 'updateBadge', status: 'completed' })
      return { status: 'completed', translatedCount: translatableElements.length }
    }

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
  infoDiv.className = 'translation-info'
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

// Restore original content
function restorePage() {
  // Clean up observer
  if (translationObserver) {
    translationObserver.disconnect()
    translationObserver = null
  }
  
  // Clear translation state
  translatedElements = new WeakSet<Element>()
  pendingTranslations.clear()
  
  // Restore HTML content first
  const elementsWithOriginalHTML = document.querySelectorAll('[data-original-html]')
  elementsWithOriginalHTML.forEach(element => {
    const originalHTML = element.getAttribute('data-original-html')
    if (originalHTML !== null) {
      element.innerHTML = originalHTML
      element.removeAttribute('data-original-html')
    }
  })
  
  // Then restore text content
  const elementsWithOriginalText = document.querySelectorAll('[data-original-text]')
  elementsWithOriginalText.forEach(element => {
    const originalText = element.getAttribute('data-original-text')
    if (originalText !== null) {
      // Find text node in element
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null
      )
      
      const textNode = walker.nextNode()
      if (textNode) {
        textNode.textContent = originalText
      }
      
      element.removeAttribute('data-original-text')
    }
  })

  return { status: 'restored' }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log('[Content] Received message:', request)
  if (request.action === 'translate') {
    console.log('[Content] Starting translation')
    translatePage().then(result => {
      console.log('[Content] Translation completed:', result)
      sendResponse(result)
    }).catch(error => {
      console.error('[Content] Translation error:', error)
      sendResponse({ status: 'error', message: error.message })
    })
    return true // Will respond asynchronously
  } else if (request.action === 'restore') {
    console.log('[Content] Restoring page')
    sendResponse(restorePage())
  }
})

// Log that content script is loaded
console.log('[Content] Content script loaded and ready')

export {}