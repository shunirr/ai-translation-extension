// Content script for AI Translation Extension

import { getTranslatableElements } from './element-translator'
import { BatchTranslator } from './batch-translator'
import { isReaderable, extractReadableRoot } from './readability-adapter'

interface TranslationSettings {
  apiEndpoint: string
  apiKey: string
  model: string
  targetLanguage: string
  batchSize?: number
  readabilityMode?: 'off' | 'limited' | 'overlay' | 'hybrid'
  charThreshold?: number
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
function createTranslationObserver(settings: TranslationSettings): IntersectionObserver {
  const batchTranslator = new BatchTranslator({
    maxCharactersPerBatch: settings.batchSize
  })
  
  let pendingElements: Element[] = []
  let batchTimeout: NodeJS.Timeout | null = null
  let totalObservedElements = 0  // Track total elements being observed
  
  const processPendingBatch = async () => {
    if (pendingElements.length === 0) return
    
    const elementsToTranslate = [...pendingElements]
    pendingElements = []
    
    // Show progress indicator for scroll-triggered translations
    showProgress()
    // Update badge to show translation in progress
    chrome.runtime.sendMessage({ action: 'updateBadge', status: 'translating' })
    
    try {
      await batchTranslator.translateElements(elementsToTranslate, settings)
      
      // Hide progress after successful translation
      hideProgress()
      
      // Check if all observed elements have been translated
      const allTranslated = document.querySelectorAll('[data-translated="true"]').length >= totalObservedElements
      
      if (allTranslated) {
        // All elements translated, clear badge
        chrome.runtime.sendMessage({ action: 'updateBadge', status: 'completed' })
      } else {
        // Keep badge showing "..." to indicate background translation is active
        chrome.runtime.sendMessage({ action: 'updateBadge', status: 'translating' })
      }
    } catch (error) {
      // On error, remove from translatedElements so it can be retried
      elementsToTranslate.forEach(element => {
        translatedElements.delete(element)
        // Mark element as failed for potential retry
        element.setAttribute('data-translation-failed', 'true')
      })
      console.error('Batch translation error:', error)
      
      // Hide progress and show error status
      hideProgress()
      chrome.runtime.sendMessage({ action: 'updateBadge', status: 'error' })
      
      // Re-observe failed elements after a delay to allow retry
      setTimeout(() => {
        elementsToTranslate.forEach(element => {
          // Re-observe the element to trigger retry on next scroll
          observer.unobserve(element)
          observer.observe(element)
        })
      }, 1000)
    }
  }
  
  const observer = new IntersectionObserver(
    (entries) => {
      const newVisibleElements: Element[] = []
      
      entries.forEach(entry => {
        if (entry.isIntersecting && 
            !translatedElements.has(entry.target) && 
            !entry.target.hasAttribute('data-translated')) {
          newVisibleElements.push(entry.target)
          // Mark as pending to prevent duplicate processing
          translatedElements.add(entry.target)
          // Remove failed flag if it exists (for retry)
          if (entry.target.hasAttribute('data-translation-failed')) {
            entry.target.removeAttribute('data-translation-failed')
          }
        }
      })
      
      if (newVisibleElements.length > 0) {
        pendingElements.push(...newVisibleElements)
        
        // Clear existing timeout
        if (batchTimeout) clearTimeout(batchTimeout)
        
        // Wait 100ms to collect more elements before processing
        batchTimeout = setTimeout(() => {
          processPendingBatch()
        }, 100)
      }
    },
    {
      rootMargin: '50px', // Start translating 50px before element comes into view
      threshold: 0.1
    }
  )
  
  // Store the total count setter on the observer
  ;(observer as any).setTotalElements = (count: number) => {
    totalObservedElements = count
  }
  
  return observer
}

// Translate the page (viewport-based)
async function translatePage() {
  if (isTranslating) {
    return { status: 'already_translating', message: 'Translation already in progress' }
  }

  isTranslating = true
  showProgress()
  
  // Update badge to show translation in progress
  chrome.runtime.sendMessage({ action: 'updateBadge', status: 'translating' })

  try {
    // Get settings from storage
    const storageData = await chrome.storage.local.get([
      'apiEndpoint',
      'apiKey',
      'model',
      'targetLanguage',
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
      batchSize: storageData.batchSize || 1000
    }

    // Clean up existing observer
    if (translationObserver) {
      translationObserver.disconnect()
    }

    // Always use viewport-based translation (Smart Translation)
    {
      // Set up intersection observer for viewport-based translation
      translationObserver = createTranslationObserver(settings)
      
      let observedCount = 0
      
      // Determine root element based on readability mode
      let rootElement = document.body
      
      // Apply readability-based extraction if enabled
      if (settings.readabilityMode && settings.readabilityMode !== 'off') {
        // Check if document is probably readerable
        if (isReaderable(document)) {
          console.debug('Document is readerable, attempting to extract article root')
          
          const extractedRoot = extractReadableRoot(document, {
            charThreshold: settings.charThreshold ?? 500
          })
          
          if (extractedRoot) {
            console.debug('Using extracted root element for translation:', extractedRoot.tagName)
            rootElement = extractedRoot as HTMLElement
            
            // Show info about optimized translation
            showInfo('Using optimized article translation mode')
          } else {
            console.debug('Could not extract article root, falling back to full page')
          }
        } else {
          console.debug('Document is not readerable, using full page translation')
        }
      }
      
      // Get translatable elements from the determined root
      const translatableElements = getTranslatableElements(rootElement)
      
      translatableElements.forEach(element => {
        // Just observe element without setting up individual translation
        translationObserver!.observe(element)
        observedCount++
      })
      
      // Set the total elements count on the observer
      ;(translationObserver as any).setTotalElements(observedCount)
      
      // Translate visible elements immediately
      const visibleElements = translatableElements.filter(el => {
        const rect = el.getBoundingClientRect()
        return rect.top < window.innerHeight && rect.bottom > 0
      })
      
      // Use batch translator for visible elements
      const batchTranslator = new BatchTranslator({
        maxCharactersPerBatch: settings.batchSize
      })
      
      // Update progress
      if (progressIndicator) {
        progressIndicator.textContent = `Translating visible content... (${visibleElements.length} elements)`
      }
      
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
        // Keep badge showing "..." to indicate more translations will happen on scroll
        chrome.runtime.sendMessage({ action: 'updateBadge', status: 'translating' })
      } else {
        // All elements translated, clear badge
        chrome.runtime.sendMessage({ action: 'updateBadge', status: 'completed' })
      }
      
      return { status: 'completed', translatedCount: visibleElements.length, totalElements: observedCount }
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
  if (request.action === 'translate') {
    translatePage().then(sendResponse)
    return true // Will respond asynchronously
  } else if (request.action === 'restore') {
    sendResponse(restorePage())
  }
})

export {}