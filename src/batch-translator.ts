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
}

export interface BatchTranslationConfig {
  maxCharactersPerBatch?: number
  batchDelimiter?: string
}

const DEFAULT_MAX_CHARACTERS = 4000 // Maximum safe limit for most models
const DEFAULT_DELIMITER = '\n---DELIMITER---\n' // 17 characters

export class BatchTranslator {
  private config: Required<BatchTranslationConfig>
  
  constructor(config: BatchTranslationConfig = {}) {
    this.config = {
      maxCharactersPerBatch: config.maxCharactersPerBatch || DEFAULT_MAX_CHARACTERS,
      batchDelimiter: config.batchDelimiter || DEFAULT_DELIMITER
    }
  }
  
  // Process elements in batches
  async translateElements(elements: Element[], settings: TranslationSettings): Promise<void> {
    const items = this.prepareTranslationItems(elements)
    const batches = this.createBatches(items, settings)
    
    // Process each batch
    for (const batch of batches) {
      await this.processBatch(batch, settings)
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
    
    // Now batch all uncached items, maximizing batch size utilization
    // Use TextEncoder to accurately measure byte size
    const encoder = new TextEncoder()
    
    for (const item of uncachedItems) {
      // Calculate the byte size this item would add to the batch
      const itemBytes = encoder.encode(item.placeholderText).length
      const delimiterBytes = currentBatch.length > 0 ? encoder.encode(this.config.batchDelimiter).length : 0
      const totalItemSize = itemBytes + delimiterBytes
      
      // Only create new batch if adding this item would exceed the limit
      // AND we already have items in the current batch
      if (currentBatch.length > 0 && currentSize + totalItemSize > this.config.maxCharactersPerBatch) {
        batches.push(currentBatch)
        currentBatch = []
        currentSize = 0
      }
      
      currentBatch.push(item)
      currentSize += totalItemSize
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
            // Cache the translation
            translationCache.set(item.placeholderText, settings.targetLanguage, translation)
            
            // Apply to element
            const restoredHTML = placeholdersToHtml(translation, item.placeholderMap)
            item.element.innerHTML = restoredHTML
            item.element.setAttribute('data-translated', 'true')
            // Remove failed flag if it was set
            item.element.removeAttribute('data-translation-failed')
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