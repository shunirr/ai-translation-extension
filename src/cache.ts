// LRU Cache implementation for translation results

export interface CacheEntry {
  translatedText: string
  timestamp: number
}

export class TranslationCache {
  private cache: Map<string, CacheEntry>
  private maxSize: number
  
  constructor(maxSize: number = 1000) {
    this.cache = new Map()
    this.maxSize = maxSize
  }
  
  // Generate cache key from text and target language
  private generateKey(text: string, targetLanguage: string): string {
    const combined = `${targetLanguage}:${text}`
    // Simple hash function
    let hash = 0
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }
  
  // Get cached translation
  get(text: string, targetLanguage: string): string | null {
    const key = this.generateKey(text, targetLanguage)
    const entry = this.cache.get(key)
    
    if (entry) {
      // Move to end (most recently used)
      this.cache.delete(key)
      this.cache.set(key, entry)
      return entry.translatedText
    }
    
    return null
  }
  
  // Set cached translation
  set(text: string, targetLanguage: string, translatedText: string): void {
    const key = this.generateKey(text, targetLanguage)
    
    // Remove oldest entry if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
    
    this.cache.set(key, {
      translatedText,
      timestamp: Date.now()
    })
  }
  
  // Clear cache
  clear(): void {
    this.cache.clear()
  }
  
  // Get cache size
  size(): number {
    return this.cache.size
  }
}

// Global cache instance
export const translationCache = new TranslationCache()