// Element-based translation approach (simplified)
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

// Simplified approach: Get all leaf elements with text
export function getTranslatableElements(root: Element = document.body): Element[] {
  const elements: Element[] = []
  const processed = new Set<Element>()
  
  // Walk through DOM and find appropriate elements with text
  walkDOM(root, (element) => {
    // Skip if already processed or translated
    if (processed.has(element) ||
        element.hasAttribute('data-translated') ||
        element.hasAttribute('data-original-html')) {
      return
    }
    
    // Skip certain elements
    if (shouldSkipElement(element)) {
      return
    }
    
    // Get text content
    const text = getTextContent(element)
    // Reduce minimum text length to catch shorter content
    if (text.length < 5) return
    
    // Check if this element is a good candidate for translation
    // Prefer block-level elements and list items
    const preferredTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'DD', 'DT', 'BLOCKQUOTE', 'FIGCAPTION']
    const isPreferred = preferredTags.includes(element.tagName)
    
    // For DIV elements, include if they have text content and are appropriate size
    const isDivCandidate = element.tagName === 'DIV' && (
      hasDirectTextContent(element) || isLeafWithInlineContent(element)
    )
    
    // Check element size
    const htmlSize = new TextEncoder().encode(element.innerHTML).length
    
    // If element is appropriate and has text, add it
    // Increase size limit for preferred elements (P, H1-H6, etc.) to handle complex Wikipedia content
    const sizeLimit = isPreferred ? 8000 : 3000
    if (htmlSize <= sizeLimit && (isPreferred || isDivCandidate)) {
      // Check if any parent is already processed
      if (!hasProcessedAncestor(element, processed)) {
        elements.push(element)
        processed.add(element)
        
        // Mark descendants as processed
        markDescendants(element, processed)
      }
    }
  })
  
  return elements
}

// Walk through DOM tree
function walkDOM(node: Element, callback: (element: Element) => void): void {
  // Process children first (depth-first)
  const children = Array.from(node.children)
  children.forEach(child => walkDOM(child, callback))
  
  // Then process this node
  callback(node)
}

// Check if element should be skipped
function shouldSkipElement(element: Element): boolean {
  const tagName = element.tagName
  
  // Skip non-content elements
  const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED',
                    'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'NAV', 'HEADER', 
                    'FOOTER', 'ASIDE', 'FORM', 'FIELDSET']
  
  if (skipTags.includes(tagName)) {
    return true
  }
  
  // Skip elements with certain roles
  const role = element.getAttribute('role')
  if (role && ['navigation', 'button', 'menu', 'menubar', 'toolbar'].includes(role)) {
    return true
  }
  
  return false
}

// Get text content of element
function getTextContent(element: Element): string {
  let text = ''
  
  // Walk through all text nodes
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        const parent = node.parentElement
        if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') {
          return NodeFilter.FILTER_REJECT
        }
        return NodeFilter.FILTER_ACCEPT
      }
    }
  )
  
  let textNode
  while ((textNode = walker.nextNode())) {
    const nodeText = (textNode.textContent || '').trim()
    if (nodeText) {
      text += nodeText + ' '
    }
  }
  
  return text.trim()
}

// Check if any ancestor is processed
function hasProcessedAncestor(element: Element, processed: Set<Element>): boolean {
  let parent = element.parentElement
  while (parent) {
    if (processed.has(parent)) {
      return true
    }
    parent = parent.parentElement
  }
  return false
}

// Mark all descendants as processed
function markDescendants(element: Element, processed: Set<Element>): void {
  element.querySelectorAll('*').forEach(desc => processed.add(desc))
}

// Check if element has direct text content (not just from children)
function hasDirectTextContent(element: Element): boolean {
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      return true
    }
  }
  return false
}

// Check if element is a leaf with inline content only
function isLeafWithInlineContent(element: Element): boolean {
  // Check if all children are inline elements
  const inlineTags = ['SPAN', 'A', 'EM', 'STRONG', 'B', 'I', 'U', 'CODE', 'SMALL', 'SUB', 'SUP', 'MARK', 'ABBR', 'CITE', 'Q', 'S', 'DEL', 'INS', 'KBD', 'SAMP', 'VAR']
  
  const children = element.children
  if (children.length === 0) {
    return true
  }
  
  // Check if all children are inline elements
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    // If child is not an inline element, check if it has block-level children
    if (!inlineTags.includes(child.tagName)) {
      // Check if the child has any block-level elements
      const hasBlockChild = child.querySelector('p, div, h1, h2, h3, h4, h5, h6, li, table, blockquote, pre, section, article, header, footer, nav, aside')
      if (hasBlockChild) {
        return false
      }
    }
  }
  
  return true
}