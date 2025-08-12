// Readability integration for article content extraction
import { isProbablyReaderable, Readability } from '@mozilla/readability'

export interface ReadabilityOptions {
  charThreshold?: number
  keepClasses?: boolean
  classesToPreserve?: string[]
}

export interface ExtractedArticle {
  content: Element
  title?: string
  excerpt?: string
  byline?: string
  siteName?: string
}

// Check if the document is probably readerable (article-like content)
export function isReaderable(doc: Document, options?: { minContentLength?: number; minScore?: number }): boolean {
  return isProbablyReaderable(doc, options)
}

// Extract readable content and find corresponding root element in original DOM
export function extractReadableRoot(doc: Document, options?: ReadabilityOptions): Element | null {
  try {
    // Clone document to avoid modifying the original DOM
    const documentClone = doc.cloneNode(true) as Document
    
    // Configure Readability with serializer to get Element instead of HTML string
    const reader = new Readability(documentClone, {
      charThreshold: options?.charThreshold ?? 500,
      keepClasses: options?.keepClasses ?? false,
      classesToPreserve: options?.classesToPreserve,
      serializer: (el: Node) => el as Element // Return Element directly
    })
    
    // Parse the document
    const article = reader.parse()
    if (!article || !article.content) {
      console.debug('Readability: No article content found')
      return null
    }
    
    // Get the extracted content as Element
    const extractedContent = article.content as unknown as Element
    if (!extractedContent) {
      console.debug('Readability: Failed to get extracted content as Element')
      return null
    }
    
    // Find the corresponding root element in the original DOM
    const rootElement = findMatchingRootInOriginalDOM(doc, extractedContent)
    
    if (rootElement) {
      console.debug('Readability: Found matching root element:', rootElement.tagName, rootElement.id || rootElement.className)
    } else {
      console.debug('Readability: Could not find matching root element in original DOM')
    }
    
    return rootElement
  } catch (error) {
    console.error('Readability: Error extracting readable content:', error)
    return null
  }
}

// Find the best matching root element in the original DOM based on extracted content
function findMatchingRootInOriginalDOM(doc: Document, extractedContent: Element): Element | null {
  // Get text samples from extracted content for matching
  const extractedText = getTextSample(extractedContent, 500)
  if (!extractedText) return null
  
  // Candidate selectors for article content
  const candidateSelectors = [
    'main',
    'article',
    '[role="main"]',
    '[role="article"]',
    '#content',
    '#main-content',
    '#main',
    '.content',
    '.main-content',
    '.article-content',
    '.post-content',
    '.entry-content',
    '.page-content',
    '[itemprop="articleBody"]'
  ]
  
  let bestMatch: Element | null = null
  let bestScore = 0
  
  // Check each candidate
  for (const selector of candidateSelectors) {
    const elements = doc.querySelectorAll(selector)
    for (const element of elements) {
      // Skip if element is hidden or too small
      if (!isElementVisible(element)) continue
      
      // Calculate overlap score
      const elementText = getTextSample(element, 500)
      const score = calculateTextOverlap(extractedText, elementText)
      
      if (score > bestScore) {
        bestScore = score
        bestMatch = element
      }
    }
  }
  
  // If no good match found, try to find the element with most content overlap
  if (!bestMatch || bestScore < 0.5) {
    const allElements = doc.querySelectorAll('div, section, main, article')
    for (const element of allElements) {
      if (!isElementVisible(element)) continue
      
      const elementText = getTextSample(element, 500)
      const score = calculateTextOverlap(extractedText, elementText)
      
      if (score > bestScore) {
        bestScore = score
        bestMatch = element
      }
    }
  }
  
  // Require at least 60% overlap to consider it a match
  return bestScore >= 0.6 ? bestMatch : null
}

// Get text sample from element for comparison
function getTextSample(element: Element, maxLength: number): string {
  const textContent = element.textContent || ''
  // Remove extra whitespace and trim
  const normalized = textContent.replace(/\s+/g, ' ').trim()
  return normalized.slice(0, maxLength)
}

// Calculate text overlap ratio between two strings
function calculateTextOverlap(text1: string, text2: string): number {
  if (!text1 || !text2) return 0
  
  // Simple approach: find longest common substring ratio
  const shorter = text1.length <= text2.length ? text1 : text2
  const longer = text1.length > text2.length ? text1 : text2
  
  // Check if shorter text is contained in longer text
  if (longer.includes(shorter)) {
    return shorter.length / longer.length
  }
  
  // Calculate word-based overlap
  const words1 = text1.toLowerCase().split(/\s+/)
  const words2 = text2.toLowerCase().split(/\s+/)
  const set1 = new Set(words1)
  const set2 = new Set(words2)
  
  let commonWords = 0
  for (const word of set1) {
    if (set2.has(word)) commonWords++
  }
  
  const totalUniqueWords = new Set([...words1, ...words2]).size
  return totalUniqueWords > 0 ? commonWords / totalUniqueWords : 0
}

// Check if element is visible
function isElementVisible(element: Element): boolean {
  const style = window.getComputedStyle(element)
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    element.clientHeight > 0
  )
}

// Extract article content as standalone element for overlay mode
export function extractArticleForOverlay(doc: Document, options?: ReadabilityOptions): ExtractedArticle | null {
  try {
    const documentClone = doc.cloneNode(true) as Document
    
    const reader = new Readability(documentClone, {
      charThreshold: options?.charThreshold ?? 500,
      keepClasses: options?.keepClasses ?? false,
      classesToPreserve: options?.classesToPreserve,
      serializer: (el: Node) => el as Element
    })
    
    const article = reader.parse()
    if (!article || !article.content) {
      return null
    }
    
    return {
      content: article.content as unknown as Element,
      title: article.title || undefined,
      excerpt: article.excerpt || undefined,
      byline: article.byline || undefined,
      siteName: article.siteName || undefined
    }
  } catch (error) {
    console.error('Readability: Error extracting article for overlay:', error)
    return null
  }
}