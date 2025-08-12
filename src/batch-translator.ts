// Batch translation functionality
import { translationCache } from './cache'
import { htmlToPlaceholders, placeholdersToHtml } from './utils'
import { translateText } from './api'

interface TranslationSettings {
  apiEndpoint: string
  apiKey: string
  model: string
  targetLanguage: string
}

interface TranslationItem {
  element: Element
  originalHTML: string
  placeholderText: string
  placeholderMap: Map<string, string>
  chunkIndex?: number  // For tracking split chunks
  totalChunks?: number // Total number of chunks for this element
  chunkId?: string     // Unique ID to group chunks together
}

export interface BatchTranslationConfig {
  maxCharactersPerBatch?: number
  batchDelimiter?: string
}

const DEFAULT_MAX_CHARACTERS = 4000 // Maximum safe limit for most models
const DEFAULT_DELIMITER = '\n---DELIMITER---\n' // 17 characters

export class BatchTranslator {
  private config: Required<BatchTranslationConfig>
  private chunkTranslations: Map<string, string[]> = new Map() // Store translations for chunks
  
  constructor(config: BatchTranslationConfig = {}) {
    this.config = {
      maxCharactersPerBatch: config.maxCharactersPerBatch || DEFAULT_MAX_CHARACTERS,
      batchDelimiter: config.batchDelimiter || DEFAULT_DELIMITER
    }
  }
  
  // Process elements in batches
  async translateElements(
    elements: Element[], 
    settings: TranslationSettings,
    progressCallback?: (processed: number, total: number) => void
  ): Promise<void> {
    const items = this.prepareTranslationItems(elements)
    const batches = this.createBatches(items, settings)
    
    let processedItems = 0
    const totalItems = items.length
    
    // Process each batch
    for (const batch of batches) {
      await this.processBatch(batch, settings)
      
      // Update progress
      processedItems += batch.length
      if (progressCallback) {
        progressCallback(processedItems, totalItems)
      }
    }
  }
  
  private prepareTranslationItems(elements: Element[]): TranslationItem[] {
    const items: TranslationItem[] = []
    
    for (const element of elements) {
      // Skip if already translated
      if (element.hasAttribute('data-translated')) {
        continue
      }
      
      // Skip if already being processed (has original HTML stored)
      if (element.hasAttribute('data-original-html')) {
        continue
      }
      
      const originalHTML = element.innerHTML
      if (!originalHTML.trim()) {
        continue
      }
      
      // Store original HTML
      element.setAttribute('data-original-html', originalHTML)
      
      // Convert HTML to placeholders
      const { text: placeholderText, map } = htmlToPlaceholders(originalHTML)
      
      items.push({
        element,
        originalHTML,
        placeholderText,
        placeholderMap: map
      })
    }
    
    return items
  }
  
  // Split oversized item into smaller chunks based on sentences
  private splitOversizedItem(item: TranslationItem): TranslationItem[] {
    const chunks: TranslationItem[] = []
    const text = item.placeholderText
    const chunkId = `chunk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Try to split by sentence boundaries
    // Match sentence endings followed by space and capital letter or end of string
    const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)/g) || [text]
    
    let currentChunk = ''
    const maxSize = Math.floor(this.config.maxCharactersPerBatch * 0.9) // Use 90% to leave room for safety
    
    for (const sentence of sentences) {
      // If adding this sentence would exceed the limit, save current chunk
      if (currentChunk && (currentChunk.length + sentence.length) > maxSize) {
        chunks.push({
          ...item,
          placeholderText: currentChunk.trim(),
          chunkId
        })
        currentChunk = sentence
      } else {
        currentChunk += sentence
      }
    }
    
    // Add remaining chunk
    if (currentChunk.trim()) {
      chunks.push({
        ...item,
        placeholderText: currentChunk.trim(),
        chunkId
      })
    }
    
    // If we couldn't split effectively (single chunk still too large), force split
    if (chunks.length === 1 && chunks[0].placeholderText.length > this.config.maxCharactersPerBatch) {
      const forcedChunks: TranslationItem[] = []
      const text = chunks[0].placeholderText
      const chunkSize = Math.floor(this.config.maxCharactersPerBatch * 0.9)
      
      for (let i = 0; i < text.length; i += chunkSize) {
        forcedChunks.push({
          ...item,
          placeholderText: text.slice(i, i + chunkSize),
          chunkId
        })
      }
      
      // Add chunk info
      forcedChunks.forEach((chunk, index) => {
        chunk.chunkIndex = index
        chunk.totalChunks = forcedChunks.length
      })
      
      return forcedChunks
    }
    
    // Add chunk info
    chunks.forEach((chunk, index) => {
      chunk.chunkIndex = index
      chunk.totalChunks = chunks.length
    })
    
    return chunks.length > 0 ? chunks : [item]
  }
  
  private createBatches(items: TranslationItem[], settings: TranslationSettings): TranslationItem[][] {
    const batches: TranslationItem[][] = []
    let currentBatch: TranslationItem[] = []
    let currentSize = 0
    
    // Filter out cached items first
    const uncachedItems: TranslationItem[] = []
    for (const item of items) {
      const cachedTranslation = translationCache.get(item.placeholderText, settings.targetLanguage)
      if (cachedTranslation) {
        // Apply cached translation immediately
        const restoredHTML = placeholdersToHtml(cachedTranslation, item.placeholderMap)
        item.element.innerHTML = restoredHTML
        item.element.setAttribute('data-translated', 'true')
      } else {
        uncachedItems.push(item)
      }
    }
    
    // Batch items respecting element boundaries to avoid cutting sentences
    // Elements like <p>, <h1>, etc. contain complete sentences/paragraphs
    for (const item of uncachedItems) {
      const itemLength = item.placeholderText.length
      const delimiterLength = currentBatch.length > 0 ? this.config.batchDelimiter.length : 0
      const totalItemSize = itemLength + delimiterLength
      
      // Start new batch if:
      // 1. Current batch is not empty AND
      // 2. Adding this item would exceed the limit
      // This ensures complete elements (paragraphs/headers) stay together
      if (currentBatch.length > 0 && currentSize + totalItemSize > this.config.maxCharactersPerBatch) {
        batches.push(currentBatch)
        currentBatch = []
        currentSize = 0
      }
      
      // Special case: If single item exceeds max size, split it into smaller chunks
      if (currentBatch.length === 0 && itemLength > this.config.maxCharactersPerBatch) {
        console.warn(`Element exceeds max batch size (${itemLength} > ${this.config.maxCharactersPerBatch}), splitting into chunks`)
        
        // Split the oversized element into smaller chunks
        const chunks = this.splitOversizedItem(item)
        for (const chunk of chunks) {
          batches.push([chunk])
        }
        continue
      }
      
      currentBatch.push(item)
      currentSize += currentBatch.length === 1 ? itemLength : totalItemSize
    }
    
    // Add the last batch
    if (currentBatch.length > 0) {
      batches.push(currentBatch)
    }
    
    return batches
  }
  
  private async processBatch(batch: TranslationItem[], settings: TranslationSettings): Promise<void> {
    if (batch.length === 0) return
    
    // Always use batch processing, even for single items
    // This ensures all elements go through the same pipeline
    
    // Create batch text
    const batchText = batch.map(item => item.placeholderText).join(this.config.batchDelimiter)
    
    try {
      const response = await translateText({
        text: batchText,
        targetLanguage: settings.targetLanguage,
        apiEndpoint: settings.apiEndpoint,
        apiKey: settings.apiKey,
        model: settings.model
      })
      
      if (!response.error && response.translatedText) {
        // Split the response - handle various delimiter formats
        // The delimiter might appear with extra whitespace or formatting
        let translations: string[]
        if (this.config.batchDelimiter === '\n---DELIMITER---\n') {
          // For default delimiter, use flexible regex to handle variations
          const delimiterPattern = /\s*-{3,}DELIMITER-{3,}\s*/
          translations = response.translatedText.split(delimiterPattern)
        } else {
          // For custom delimiters, split exactly
          translations = response.translatedText.split(this.config.batchDelimiter)
        }
        
        // Apply translations to elements
        for (let i = 0; i < batch.length && i < translations.length; i++) {
          const item = batch[i]
          const translation = translations[i].trim()
          
          if (translation) {
            // If this is a chunk, store it for later assembly
            if (item.chunkId && item.totalChunks && item.totalChunks > 1) {
              if (!this.chunkTranslations.has(item.chunkId)) {
                this.chunkTranslations.set(item.chunkId, new Array(item.totalChunks))
              }
              const chunks = this.chunkTranslations.get(item.chunkId)!
              chunks[item.chunkIndex!] = translation
              
              // Check if all chunks are ready
              if (chunks.every(chunk => chunk !== undefined)) {
                // Combine all chunks
                const fullTranslation = chunks.join(' ')
                
                // Cache the full translation
                translationCache.set(item.originalHTML, settings.targetLanguage, fullTranslation)
                
                // Apply to element
                const restoredHTML = placeholdersToHtml(fullTranslation, item.placeholderMap)
                item.element.innerHTML = restoredHTML
                item.element.setAttribute('data-translated', 'true')
                item.element.removeAttribute('data-translation-failed')
                
                // Clean up
                this.chunkTranslations.delete(item.chunkId)
              }
            } else {
              // Normal single item translation
              // Cache the translation
              translationCache.set(item.placeholderText, settings.targetLanguage, translation)
              
              // Apply to element
              const restoredHTML = placeholdersToHtml(translation, item.placeholderMap)
              item.element.innerHTML = restoredHTML
              item.element.setAttribute('data-translated', 'true')
              // Remove failed flag if it was set
              item.element.removeAttribute('data-translation-failed')
            }
          } else {
            // Mark as failed if no translation received
            item.element.setAttribute('data-translation-failed', 'true')
          }
        }
        
        // Mark any remaining items as failed if we got fewer translations
        if (translations.length < batch.length) {
          for (let i = translations.length; i < batch.length; i++) {
            batch[i].element.setAttribute('data-translation-failed', 'true')
          }
        }
      } else {
        console.error('Batch translation failed:', response.error || 'No translated text')
      }
    } catch (error) {
      console.error('Batch translation error:', error)
      // Fall back to individual translation
      for (const item of batch) {
        await this.processSingleItem(item, settings)
      }
    }
  }
  
  private async processSingleItem(item: TranslationItem, settings: TranslationSettings): Promise<void> {
    try {
      const response = await translateText({
        text: item.placeholderText,
        targetLanguage: settings.targetLanguage,
        apiEndpoint: settings.apiEndpoint,
        apiKey: settings.apiKey,
        model: settings.model
      })
      
      if (!response.error && response.translatedText) {
        // Cache the translation
        translationCache.set(item.placeholderText, settings.targetLanguage, response.translatedText)
        
        // Apply to element
        const restoredHTML = placeholdersToHtml(response.translatedText, item.placeholderMap)
        item.element.innerHTML = restoredHTML
        item.element.setAttribute('data-translated', 'true')
        // Remove failed flag if it was set
        item.element.removeAttribute('data-translation-failed')
      } else {
        // Mark as failed for potential retry
        item.element.setAttribute('data-translation-failed', 'true')
        console.error('Translation failed for element:', response.error)
      }
    } catch (error) {
      console.error('Translation error:', error)
      // Mark as failed for potential retry
      item.element.setAttribute('data-translation-failed', 'true')
    }
  }
}