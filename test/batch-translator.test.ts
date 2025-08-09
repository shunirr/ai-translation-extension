import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BatchTranslator } from '../src/batch-translator'

// Mock dependencies
vi.mock('../src/cache', () => ({
  translationCache: {
    get: vi.fn(),
    set: vi.fn(),
  }
}))

vi.mock('../src/utils', () => ({
  htmlToPlaceholders: vi.fn((html) => ({
    text: `placeholder:${html}`,
    map: new Map([['<tag_1>', '<span>'], ['</tag_1>', '</span>']])
  })),
  placeholdersToHtml: vi.fn((text) => text.replace('placeholder:', ''))
}))

vi.mock('../src/api', () => ({
  translateText: vi.fn()
}))

import { translationCache } from '../src/cache'
import { translateText } from '../src/api'

describe('BatchTranslator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Basic functionality', () => {
    it('should create batches based on character limit', async () => {
      const translator = new BatchTranslator({ maxCharactersPerBatch: 100 })
      
      // Create test elements
      const elements = [
        createTestElement('Short text'), // ~25 chars with delimiter
        createTestElement('Another short text'), // ~35 chars with delimiter
        createTestElement('This is a much longer text that should go into the next batch'), // ~80 chars
      ]
      
      const settings = {
        apiEndpoint: 'https://api.test.com',
        apiKey: 'test-key',
        model: 'test-model',
        targetLanguage: 'ja'
      }
      
      // Mock API responses
      vi.mocked(translateText).mockResolvedValueOnce({
        translatedText: '短いテキスト\n---DELIMITER---\nもう一つの短いテキスト'
      }).mockResolvedValueOnce({
        translatedText: 'これは次のバッチに入るべきもっと長いテキストです'
      })
      
      await translator.translateElements(elements, settings)
      
      // Should make 2 API calls (2 batches)
      expect(translateText).toHaveBeenCalledTimes(2)
      
      // First batch should contain first two elements
      const firstCall = vi.mocked(translateText).mock.calls[0][0]
      expect(firstCall.text).toContain('Short text')
      expect(firstCall.text).toContain('Another short text')
      expect(firstCall.text).toContain('---DELIMITER---')
      
      // Second batch should contain the long text
      const secondCall = vi.mocked(translateText).mock.calls[1][0]
      expect(secondCall.text).toContain('longer text')
    })

    it('should use cache when available', async () => {
      const translator = new BatchTranslator()
      
      const element = createTestElement('Cached text')
      const settings = {
        apiEndpoint: 'https://api.test.com',
        apiKey: 'test-key',
        model: 'test-model',
        targetLanguage: 'ja'
      }
      
      // Mock cache hit
      vi.mocked(translationCache.get).mockReturnValue('キャッシュされたテキスト')
      
      await translator.translateElements([element], settings)
      
      // Should not call API
      expect(translateText).not.toHaveBeenCalled()
      
      // Should update element
      expect(element.innerHTML).toBe('キャッシュされたテキスト')
      expect(element.getAttribute('data-translated')).toBe('true')
    })

    it('should handle single element batches', async () => {
      const translator = new BatchTranslator()
      
      const element = createTestElement('Single element')
      const settings = {
        apiEndpoint: 'https://api.test.com',
        apiKey: 'test-key',
        model: 'test-model',
        targetLanguage: 'ja'
      }
      
      vi.mocked(translateText).mockResolvedValue({
        translatedText: 'シングル要素'
      })
      
      await translator.translateElements([element], settings)
      
      // Should make direct API call without delimiter
      expect(translateText).toHaveBeenCalledTimes(1)
      const call = vi.mocked(translateText).mock.calls[0][0]
      expect(call.text).not.toContain('---DELIMITER---')
    })

    it('should fall back to individual translation on batch error', async () => {
      const translator = new BatchTranslator()
      
      const elements = [
        createTestElement('First text'),
        createTestElement('Second text')
      ]
      
      const settings = {
        apiEndpoint: 'https://api.test.com',
        apiKey: 'test-key',
        model: 'test-model',
        targetLanguage: 'ja'
      }
      
      // First call (batch) fails
      vi.mocked(translateText).mockRejectedValueOnce(new Error('Batch failed'))
      
      // Individual calls succeed
      vi.mocked(translateText)
        .mockResolvedValueOnce({ translatedText: '最初のテキスト' })
        .mockResolvedValueOnce({ translatedText: '二番目のテキスト' })
      
      await translator.translateElements(elements, settings)
      
      // Should make 3 calls: 1 batch (failed) + 2 individual
      expect(translateText).toHaveBeenCalledTimes(3)
    })

    it('should handle delimiter in response correctly', async () => {
      const translator = new BatchTranslator()
      
      const elements = [
        createTestElement('First paragraph'),
        createTestElement('Second paragraph'),
        createTestElement('Third paragraph')
      ]
      
      const settings = {
        apiEndpoint: 'https://api.test.com',
        apiKey: 'test-key',
        model: 'test-model',
        targetLanguage: 'ja'
      }
      
      vi.mocked(translateText).mockResolvedValue({
        translatedText: '最初の段落\n---DELIMITER---\n二番目の段落\n---DELIMITER---\n三番目の段落'
      })
      
      await translator.translateElements(elements, settings)
      
      // Check each element got its translation
      expect(elements[0].innerHTML).toBe('最初の段落')
      expect(elements[1].innerHTML).toBe('二番目の段落')
      expect(elements[2].innerHTML).toBe('三番目の段落')
      
      // Check cache was updated
      expect(translationCache.set).toHaveBeenCalledTimes(3)
    })

    it('should respect custom delimiter', async () => {
      const customDelimiter = '\n<<<SPLIT>>>\n'
      const translator = new BatchTranslator({ batchDelimiter: customDelimiter })
      
      const elements = [
        createTestElement('Text one'),
        createTestElement('Text two')
      ]
      
      const settings = {
        apiEndpoint: 'https://api.test.com',
        apiKey: 'test-key',
        model: 'test-model',
        targetLanguage: 'ja'
      }
      
      vi.mocked(translateText).mockResolvedValue({
        translatedText: `テキスト1${customDelimiter}テキスト2`
      })
      
      await translator.translateElements(elements, settings)
      
      // Check API was called with custom delimiter
      const call = vi.mocked(translateText).mock.calls[0][0]
      expect(call.text).toContain(customDelimiter)
    })
  })

  describe('Edge cases', () => {
    it('should skip already translated elements', async () => {
      const translator = new BatchTranslator()
      
      const element = createTestElement('Already done')
      element.setAttribute('data-translated', 'true')
      
      const settings = {
        apiEndpoint: 'https://api.test.com',
        apiKey: 'test-key',
        model: 'test-model',
        targetLanguage: 'ja'
      }
      
      await translator.translateElements([element], settings)
      
      expect(translateText).not.toHaveBeenCalled()
    })

    it('should skip empty elements', async () => {
      const translator = new BatchTranslator()
      
      const element = createTestElement('')
      
      const settings = {
        apiEndpoint: 'https://api.test.com',
        apiKey: 'test-key',
        model: 'test-model',
        targetLanguage: 'ja'
      }
      
      await translator.translateElements([element], settings)
      
      expect(translateText).not.toHaveBeenCalled()
    })

    it('should handle mismatched translation count', async () => {
      const translator = new BatchTranslator()
      
      const elements = [
        createTestElement('First'),
        createTestElement('Second'),
        createTestElement('Third')
      ]
      
      const settings = {
        apiEndpoint: 'https://api.test.com',
        apiKey: 'test-key',
        model: 'test-model',
        targetLanguage: 'ja'
      }
      
      // Return only 2 translations for 3 elements
      vi.mocked(translateText).mockResolvedValue({
        translatedText: '最初\n---DELIMITER---\n二番目'
      })
      
      await translator.translateElements(elements, settings)
      
      // First two should be translated
      expect(elements[0].innerHTML).toBe('最初')
      expect(elements[1].innerHTML).toBe('二番目')
      
      // Third should remain unchanged
      expect(elements[2].getAttribute('data-translated')).toBeNull()
    })
  })
})

// Helper function to create test elements
function createTestElement(content: string): Element {
  const element = document.createElement('p')
  element.innerHTML = content
  return element
}