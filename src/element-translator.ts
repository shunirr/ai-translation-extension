// Element-based translation approach
import { translateText } from './api'
import { translationCache } from './cache'
import { htmlToPlaceholders, placeholdersToHtml } from './utils'

interface TranslationSettings {
  apiEndpoint: string
  apiKey: string
  model: string
  targetLanguage: string
}

// Translate an element with HTML content
export async function translateElement(element: Element, settings: TranslationSettings): Promise<void> {
  // Skip if already translated
  if (element.hasAttribute('data-translated')) {
    return
  }

  // Get inner HTML
  const originalHTML = element.innerHTML
  
  // Skip if no content
  if (!originalHTML.trim()) {
    return
  }

  // Store original HTML
  element.setAttribute('data-original-html', originalHTML)
  
  // Convert HTML to placeholders
  const { text: placeholderText, map } = htmlToPlaceholders(originalHTML)
  
  // Check cache
  const cachedTranslation = translationCache.get(placeholderText, settings.targetLanguage)
  
  if (cachedTranslation) {
    const restoredHTML = placeholdersToHtml(cachedTranslation, map)
    element.innerHTML = restoredHTML
    element.setAttribute('data-translated', 'true')
    return
  }
  
  // Translate via API
  try {
    const response = await translateText({
      text: placeholderText,
      targetLanguage: settings.targetLanguage,
      apiEndpoint: settings.apiEndpoint,
      apiKey: settings.apiKey,
      model: settings.model
    })
    
    if (!response.error) {
      // Cache the translation
      translationCache.set(placeholderText, settings.targetLanguage, response.translatedText)
      
      // Restore HTML and apply
      const restoredHTML = placeholdersToHtml(response.translatedText, map)
      element.innerHTML = restoredHTML
      element.setAttribute('data-translated', 'true')
    }
  } catch (error) {
    console.error('Translation error:', error)
  }
}

// Get translatable elements from the page
export function getTranslatableElements(root: Element = document.body): Element[] {
  const elements: Element[] = []
  
  // Select content elements that typically contain translatable text
  const selectors = [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'li', 'td', 'th', 'blockquote', 'figcaption',
    'dd', 'dt', '.text', '.content', '[class*="text"]',
    'div[class*="content"]', 'div[class*="article"]', 'div[class*="wiki"]',
    'div[class*="body"]', 'div[class*="main"]', 'div[class*="paragraph"]',
    'span[class*="text"]', 'span[class*="content"]',
    // Common wiki/documentation selectors
    '.wiki-paragraph', '.wiki-heading', '.wiki-content',
    '.document-content', '.article-body', '.entry-content',
    // Namu wiki specific
    '[class*="wiki-paragraph"]', '[class*="wiki-heading"]',
    '[class*="w-"]', '.wiki-table-wrapper td', '.wiki-table-wrapper th'
  ]
  
  const candidates = root.querySelectorAll(selectors.join(','))
  
  candidates.forEach(element => {
    // Skip if already translated
    if (element.hasAttribute('data-translated') || element.hasAttribute('data-original-html')) {
      return
    }
    
    // Skip UI elements
    if (element.closest('nav, header, footer, button, input, select, textarea, [role="navigation"], [role="button"], [role="menu"]')) {
      return
    }
    
    // Skip if contains many nested block elements (likely a container)
    // But allow elements with a few nested elements (like div with spans)
    const blockElements = element.querySelectorAll('p, div, section, article, h1, h2, h3, h4, h5, h6')
    if (blockElements.length > 3) {
      return
    }
    
    // Skip if the element is too large (likely a container)
    const elementText = element.textContent?.trim() || ''
    if (elementText.length > 5000) {
      return
    }
    
    // Check if has meaningful text content
    const text = element.textContent?.trim()
    if (!text || text.length < 5) {
      return
    }
    
    // Skip if text is mostly numbers or special characters
    const letterCount = (text.match(/[\p{L}]/gu) || []).length
    if (letterCount < text.length * 0.3) {
      return
    }
    
    elements.push(element)
  })
  
  return elements
}