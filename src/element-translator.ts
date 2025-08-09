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
  const isNamuWiki = window.location.hostname.includes('namu.wiki')
  
  // Select content elements that typically contain translatable text
  const selectors = [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'li', 'td', 'th', 'blockquote', 'figcaption',
    'dd', 'dt', '.text', '.content', '[class*="text"]',
    // Add div selectors for wiki content
    'div.wiki-paragraph', 'div.wiki-paragraph-indent', 
    'div[class*="wiki-heading"]', 'div[class*="wiki-table"]',
    'div.wiki-paragraph > div', 'div[itemprop="articleBody"] > div',
    // Namu wiki specific selectors
    '.w > div', '.wiki-inner-content > div',
    'div[class^="wiki-"]', 'div[class*=" wiki-"]'
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
    
    // Special handling for namu.wiki - allow some nested elements
    if (isNamuWiki && element.classList.contains('wiki-paragraph')) {
      // For wiki-paragraph, don't skip even if it has nested elements
      const text = element.textContent?.trim()
      if (text && text.length >= 10) {
        elements.push(element)
        return
      }
    }
    
    // Skip if contains nested block elements (process leaves instead)
    const blockElements = element.querySelectorAll('p, div, section, article, h1, h2, h3, h4, h5, h6')
    if (blockElements.length > 0) {
      return
    }
    
    // Check if has meaningful text content
    const text = element.textContent?.trim()
    if (!text || text.length < 10) {
      return
    }
    
    elements.push(element)
  })
  
  // If namu.wiki and found too few elements, try alternative approach
  if (isNamuWiki && elements.length < 5) {
    
    // Find all text nodes and their parent elements
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const text = node.textContent?.trim() || ''
          // Skip short text and whitespace
          if (text.length < 10) return NodeFilter.FILTER_REJECT
          // Skip if parent is script or style
          const parent = node.parentElement
          if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') {
            return NodeFilter.FILTER_REJECT
          }
          // Skip UI elements
          if (parent.closest('nav, header, footer, button, input, select, textarea, [role="navigation"], [role="button"], [role="menu"]')) {
            return NodeFilter.FILTER_REJECT
          }
          return NodeFilter.FILTER_ACCEPT
        }
      }
    )
    
    const textNodes: Node[] = []
    let node = walker.nextNode()
    while (node) {
      textNodes.push(node)
      node = walker.nextNode()
    }
    
    
    // Group text nodes by their closest block parent
    const blockParents = new Map<Element, Node[]>()
    textNodes.forEach(textNode => {
      const blockParent = textNode.parentElement?.closest('div, p, li, td, th, h1, h2, h3, h4, h5, h6, blockquote, dd, dt')
      if (blockParent && !blockParent.hasAttribute('data-translated')) {
        if (!blockParents.has(blockParent)) {
          blockParents.set(blockParent, [])
        }
        blockParents.get(blockParent)!.push(textNode)
      }
    })
    
    
    // Add block parents that contain significant text
    blockParents.forEach((nodes, parent) => {
      const combinedText = nodes.map(n => n.textContent?.trim()).join(' ')
      if (combinedText.length >= 10 && !elements.includes(parent)) {
        elements.push(parent)
      }
    })
  }
  
  return elements
}