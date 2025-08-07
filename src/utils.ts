// Utility functions for text processing and DOM manipulation

export interface TextCluster {
  nodes: Node[]
  text: string
  placeholderText: string
  placeholderMap: Map<string, string>
}

// Extract text nodes from an element, excluding UI elements
export function extractTextNodes(element: Element): Node[] {
  const textNodes: Node[] = []
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement
        if (!parent) return NodeFilter.FILTER_REJECT
        
        // Skip script, style, and other non-content elements
        const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED']
        if (skipTags.includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT
        }
        
        // Skip empty or whitespace-only text
        if (!node.textContent || node.textContent.trim().length === 0) {
          return NodeFilter.FILTER_REJECT
        }
        
        // Skip UI elements (buttons, navigation, etc.)
        const uiSelectors = [
          'nav', 'header', 'footer', 'button', 'input', 'select', 'textarea',
          '[role="navigation"]', '[role="button"]', '[role="menu"]'
        ]
        if (uiSelectors.some(selector => parent.closest(selector))) {
          return NodeFilter.FILTER_REJECT
        }
        
        return NodeFilter.FILTER_ACCEPT
      }
    }
  )
  
  let node
  while ((node = walker.nextNode())) {
    textNodes.push(node)
  }
  
  return textNodes
}

// Convert HTML content to placeholder format
export function htmlToPlaceholders(html: string): { text: string; map: Map<string, string> } {
  const placeholderMap = new Map<string, string>()
  let placeholderIndex = 0
  
  // Replace HTML tags with placeholders
  const text = html.replace(/<(\/?[^>]+)>/g, (match, tag) => {
    // Extract tag name and determine if it's a closing tag
    const isClosing = tag.startsWith('/')
    const tagName = tag.replace(/^\//, '').split(/[\s>]/)[0].toLowerCase().replace(/[^a-z0-9]/g, '')
    const placeholder = isClosing ? `</${tagName}_${placeholderIndex}>` : `<${tagName}_${placeholderIndex}>`
    placeholderMap.set(placeholder, match)
    placeholderIndex++
    return placeholder
  })
  
  return { text, map: placeholderMap }
}

// Restore placeholders back to HTML
export function placeholdersToHtml(text: string, map: Map<string, string>): string {
  let result = text
  
  // Sort placeholders by length (longest first) to avoid partial replacements
  const sortedPlaceholders = Array.from(map.keys()).sort((a, b) => b.length - a.length)
  
  for (const placeholder of sortedPlaceholders) {
    const original = map.get(placeholder)
    if (original) {
      // First try exact match
      result = result.replace(new RegExp(escapeRegExp(placeholder), 'g'), original)
      
      // Handle variations with spaces (e.g., "< a_4>" instead of "<a_4>")
      const placeholderWithSpaces = placeholder.replace(/</g, '< ').replace(/>/g, ' >')
      if (result.includes(placeholderWithSpaces)) {
        result = result.replace(new RegExp(escapeRegExp(placeholderWithSpaces), 'g'), original)
      }
      
      // Handle single space after < (e.g., "< a_4>")
      const placeholderWithLeadingSpace = placeholder.replace(/</g, '< ')
      if (result.includes(placeholderWithLeadingSpace)) {
        result = result.replace(new RegExp(escapeRegExp(placeholderWithLeadingSpace), 'g'), original)
      }
      
      // Handle single space before > (e.g., "<a_4 >")
      const placeholderWithTrailingSpace = placeholder.replace(/>/g, ' >')
      if (result.includes(placeholderWithTrailingSpace)) {
        result = result.replace(new RegExp(escapeRegExp(placeholderWithTrailingSpace), 'g'), original)
      }
    }
  }
  
  // Clean up any remaining malformed placeholders that weren't in our map
  // This catches cases where the LLM created variations we didn't anticipate
  result = result.replace(/<\s*\/?\s*[a-z]+_\d+\s*>/gi, (match) => {
    // Try to find a similar placeholder in our map
    const normalizedMatch = match.replace(/\s+/g, '')
    for (const [placeholder, original] of map.entries()) {
      if (placeholder.toLowerCase() === normalizedMatch.toLowerCase()) {
        return original
      }
    }
    // If no match found, remove it to avoid displaying broken placeholders
    console.warn('Unmatched placeholder found:', match)
    return ''
  })
  
  return result
}

// Escape special regex characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Group text nodes into clusters for batch translation
export function clusterTextNodes(nodes: Node[]): TextCluster[] {
  const clusters: TextCluster[] = []
  let currentCluster: Node[] = []
  let currentText = ''
  let lastContainer: Element | null = null
  
  for (const node of nodes) {
    const text = node.textContent || ''
    const parent = node.parentElement
    
    // Skip very short texts
    if (text.trim().length < 2) {
      continue
    }
    
    // Find the semantic container (paragraph, list item, blockquote, etc.)
    const container = parent?.closest('p, li, blockquote, h1, h2, h3, h4, h5, h6, td, th, figcaption, dd, dt') || parent
    
    // Check if we're in a different semantic container
    const isDifferentContainer = lastContainer && container !== lastContainer && 
      !isRelatedContainer(lastContainer, container)
    
    // Determine if we should start a new cluster
    const shouldStartNewCluster = 
      currentCluster.length > 0 && (
        // Different semantic container (unless they're related)
        isDifferentContainer ||
        // Maximum size reached (but keep related content together)
        currentText.length > 3000
      )
    
    if (shouldStartNewCluster) {
      // Save current cluster
      clusters.push(createCluster(currentCluster))
      currentCluster = []
      currentText = ''
    }
    
    currentCluster.push(node)
    currentText += text + ' '
    lastContainer = container
  }
  
  // Add remaining nodes
  if (currentCluster.length > 0) {
    clusters.push(createCluster(currentCluster))
  }
  
  return clusters
}

// Check if two containers are related (e.g., consecutive paragraphs, list items)
function isRelatedContainer(container1: Element | null, container2: Element | null): boolean {
  if (!container1 || !container2) return false
  
  // Same parent means they're siblings
  if (container1.parentElement === container2.parentElement && container1.parentElement) {
    // Check if they're adjacent or close siblings
    const siblings = Array.from(container1.parentElement.children)
    const index1 = siblings.indexOf(container1)
    const index2 = siblings.indexOf(container2)
    const distance = Math.abs(index1 - index2)
    
    // Consider them related if they're close siblings of the same type
    if (distance <= 2) {
      // Same tag type (e.g., both paragraphs)
      if (container1.tagName === container2.tagName) return true
      
      // Both are list items
      if (container1.tagName === 'LI' && container2.tagName === 'LI') return true
      
      // Both are headings
      if (container1.tagName.match(/^H[1-6]$/) && container2.tagName.match(/^H[1-6]$/)) return true
    }
  }
  
  // Check if one is a heading and the other is the next paragraph
  if (container1.tagName.match(/^H[1-6]$/) && container2.tagName === 'P') {
    const next = container1.nextElementSibling
    return next === container2 || next?.nextElementSibling === container2
  }
  
  return false
}

// Create a text cluster from nodes
function createCluster(nodes: Node[]): TextCluster {
  if (nodes.length === 1) {
    const node = nodes[0]
    const text = node.textContent || ''
    
    // Simple text node - no HTML processing needed
    return {
      nodes,
      text,
      placeholderText: text,
      placeholderMap: new Map()
    }
  }
  
  // For multiple nodes, combine them with proper spacing
  const texts: string[] = []
  let lastContainer: Element | null = null
  
  for (const node of nodes) {
    const parent = node.parentElement
    const container = parent?.closest('p, li, blockquote, h1, h2, h3, h4, h5, h6, td, th, figcaption, dd, dt') || parent
    const text = node.textContent || ''
    
    // Add appropriate spacing between different containers
    if (lastContainer && container !== lastContainer) {
      const needsParagraphBreak = 
        lastContainer.tagName !== container?.tagName ||
        ['P', 'LI', 'BLOCKQUOTE', 'DD'].includes(lastContainer.tagName)
      
      texts.push(needsParagraphBreak ? '\n\n' : ' ')
    }
    
    texts.push(text)
    lastContainer = container
  }
  
  // Preserve some structure but clean up excessive whitespace
  const combinedText = texts.join('').replace(/\s*\n\s*\n\s*/g, '\n\n').replace(/  +/g, ' ').trim()
  
  return {
    nodes,
    text: combinedText,
    placeholderText: combinedText,
    placeholderMap: new Map()
  }
}




// Apply translated text back to nodes
export function applyTranslation(cluster: TextCluster, translatedText: string): void {
  // For single node clusters, apply directly
  if (cluster.nodes.length === 1) {
    const node = cluster.nodes[0]
    const parent = node.parentElement
    
    if (parent && node.textContent) {
      // Store original text
      if (!parent.hasAttribute('data-original-text')) {
        parent.setAttribute('data-original-text', node.textContent)
      }
      
      // Apply translated text directly
      node.textContent = translatedText
    }
    return
  }
  
  // For multi-node clusters, distribute translated text proportionally
  applyTranslationToMultipleNodes(cluster, translatedText)
}

// Apply translation to multiple nodes
function applyTranslationToMultipleNodes(cluster: TextCluster, translatedText: string): void {
  // Split translated text into sentences/phrases
  const translatedSentences = translatedText.match(/[^.!?]+[.!?]+/g) || [translatedText]
  const originalTexts = cluster.nodes.map(n => n.textContent || '')
  const originalLengths = originalTexts.map(t => t.length)
  const totalOriginalLength = originalLengths.reduce((sum, len) => sum + len, 0)
  
  // Calculate how to distribute the translated text
  let currentSentenceIndex = 0
  let currentCharCount = 0
  const nodeTranslations: string[] = []
  
  for (let i = 0; i < cluster.nodes.length; i++) {
    const targetLength = originalLengths[i]
    const targetRatio = targetLength / totalOriginalLength
    const targetTranslatedLength = Math.round(translatedText.length * targetRatio)
    
    let nodeText = ''
    
    // Collect sentences until we reach approximately the target length
    while (currentSentenceIndex < translatedSentences.length && 
           currentCharCount < targetTranslatedLength) {
      const sentence = translatedSentences[currentSentenceIndex]
      
      // Check if adding this sentence would exceed our target by too much
      if (nodeText && currentCharCount + sentence.length > targetTranslatedLength * 1.5) {
        break
      }
      
      nodeText += (nodeText ? ' ' : '') + sentence
      currentCharCount += sentence.length
      currentSentenceIndex++
    }
    
    // If no sentences were assigned, take a proportional chunk
    if (!nodeText && currentSentenceIndex < translatedSentences.length) {
      nodeText = translatedSentences[currentSentenceIndex]
      currentSentenceIndex++
    }
    
    nodeTranslations.push(nodeText.trim())
  }
  
  // Handle any remaining sentences
  if (currentSentenceIndex < translatedSentences.length) {
    const remaining = translatedSentences.slice(currentSentenceIndex).join(' ')
    if (nodeTranslations.length > 0) {
      nodeTranslations[nodeTranslations.length - 1] += ' ' + remaining
    }
  }
  
  // Apply translations to nodes
  for (let i = 0; i < cluster.nodes.length && i < nodeTranslations.length; i++) {
    const node = cluster.nodes[i]
    const parent = node.parentElement
    const translation = nodeTranslations[i]
    
    if (parent && node.textContent && translation) {
      // Store original text
      if (!parent.hasAttribute('data-original-text')) {
        parent.setAttribute('data-original-text', node.textContent)
      }
      
      // Apply translation
      node.textContent = translation
    }
  }
}