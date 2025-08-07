import { describe, it, expect, beforeEach } from 'vitest'
import { TranslationCache } from '../src/cache'

describe('TranslationCache', () => {
  let cache: TranslationCache

  beforeEach(() => {
    cache = new TranslationCache(3) // Small cache for testing
  })

  describe('get and set', () => {
    it('should store and retrieve translations', () => {
      const text = 'Hello world'
      const targetLanguage = 'ja'
      const translatedText = 'こんにちは世界'

      cache.set(text, targetLanguage, translatedText)
      const result = cache.get(text, targetLanguage)

      expect(result).toBe(translatedText)
    })

    it('should return null for non-existent entries', () => {
      const result = cache.get('non-existent', 'ja')
      expect(result).toBeNull()
    })

    it('should handle different languages for same text', () => {
      const text = 'Hello'
      
      cache.set(text, 'ja', 'こんにちは')
      cache.set(text, 'ko', '안녕하세요')

      expect(cache.get(text, 'ja')).toBe('こんにちは')
      expect(cache.get(text, 'ko')).toBe('안녕하세요')
    })
  })

  describe('LRU behavior', () => {
    it('should evict oldest entry when capacity is reached', () => {
      // Fill cache to capacity
      cache.set('text1', 'ja', 'translation1')
      cache.set('text2', 'ja', 'translation2')
      cache.set('text3', 'ja', 'translation3')

      // Add one more - should evict text1
      cache.set('text4', 'ja', 'translation4')

      expect(cache.get('text1', 'ja')).toBeNull()
      expect(cache.get('text2', 'ja')).toBe('translation2')
      expect(cache.get('text3', 'ja')).toBe('translation3')
      expect(cache.get('text4', 'ja')).toBe('translation4')
    })

    it('should update LRU order on get', () => {
      // Fill cache
      cache.set('text1', 'ja', 'translation1')
      cache.set('text2', 'ja', 'translation2')
      cache.set('text3', 'ja', 'translation3')

      // Access text1 to make it recently used
      cache.get('text1', 'ja')

      // Add new item - should evict text2 (least recently used)
      cache.set('text4', 'ja', 'translation4')

      expect(cache.get('text1', 'ja')).toBe('translation1')
      expect(cache.get('text2', 'ja')).toBeNull()
      expect(cache.get('text3', 'ja')).toBe('translation3')
      expect(cache.get('text4', 'ja')).toBe('translation4')
    })

    it('should not evict when updating existing entry', () => {
      cache.set('text1', 'ja', 'translation1')
      cache.set('text2', 'ja', 'translation2')
      cache.set('text3', 'ja', 'translation3')

      // Update existing entry
      cache.set('text2', 'ja', 'translation2-updated')

      expect(cache.size()).toBe(3)
      expect(cache.get('text2', 'ja')).toBe('translation2-updated')
    })
  })

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('text1', 'ja', 'translation1')
      cache.set('text2', 'ja', 'translation2')

      cache.clear()

      expect(cache.size()).toBe(0)
      expect(cache.get('text1', 'ja')).toBeNull()
      expect(cache.get('text2', 'ja')).toBeNull()
    })
  })

  describe('size', () => {
    it('should return correct cache size', () => {
      expect(cache.size()).toBe(0)

      cache.set('text1', 'ja', 'translation1')
      expect(cache.size()).toBe(1)

      cache.set('text2', 'ja', 'translation2')
      expect(cache.size()).toBe(2)

      cache.clear()
      expect(cache.size()).toBe(0)
    })
  })

  describe('hash function', () => {
    it('should generate consistent keys for same input', () => {
      const text = 'Test text with special characters: 日本語 한국어'
      const language = 'en'

      cache.set(text, language, 'translation')
      const result1 = cache.get(text, language)
      
      // Clear and set again
      cache.clear()
      cache.set(text, language, 'translation')
      const result2 = cache.get(text, language)

      expect(result1).toBe(result2)
    })

    it('should generate different keys for different inputs', () => {
      cache.set('text1', 'ja', 'translation1')
      cache.set('text2', 'ja', 'translation2')

      expect(cache.get('text1', 'ja')).toBe('translation1')
      expect(cache.get('text2', 'ja')).toBe('translation2')
    })
  })
})