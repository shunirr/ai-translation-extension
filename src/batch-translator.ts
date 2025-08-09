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

const DEFAULT_MAX_CHARACTERS = 2000 // Conservative limit for token safety
const DEFAULT_DELIMITER = '\n---DELIMITER---\n'

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
    
    for (const item of items) {
      // Check cache first
      const cachedTranslation = translationCache.get(item.placeholderText, settings.targetLanguage)
      if (cachedTranslation) {
        // Apply cached translation immediately
        const restoredHTML = placeholdersToHtml(cachedTranslation, item.placeholderMap)
        item.element.innerHTML = restoredHTML
        item.element.setAttribute('data-translated', 'true')
        continue
      }
      
      const itemSize = item.placeholderText.length + this.config.batchDelimiter.length
      
      // Check if adding this item would exceed the limit
      if (currentSize + itemSize > this.config.maxCharactersPerBatch && currentBatch.length > 0) {
        batches.push(currentBatch)
        currentBatch = []
        currentSize = 0
      }
      
      currentBatch.push(item)
      currentSize += itemSize
    }
    
    if (currentBatch.length > 0) {
      batches.push(currentBatch)
    }
    
    return batches
  }
  
  private async processBatch(batch: TranslationItem[], settings: TranslationSettings): Promise<void> {
    if (batch.length === 0) return
    
    // Single item batch - process directly
    if (batch.length === 1) {
      await this.processSingleItem(batch[0], settings)
      return
    }
    
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
        // Split the response
        const translations = response.translatedText.split(this.config.batchDelimiter)
        
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
      }
    } catch (error) {
      console.error('Translation error:', error)
    }
  }
}