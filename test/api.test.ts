import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { translateText, TranslationRequest } from '../src/api'

// Mock fetch
global.fetch = vi.fn()

describe('API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('translateText', () => {
    const baseRequest: TranslationRequest = {
      text: 'Hello world',
      targetLanguage: 'ja',
      apiEndpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: 'test-api-key',
      model: 'gpt-3.5-turbo'
    }

    it('should successfully translate text', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'こんにちは世界'
          }
        }]
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response)

      const result = await translateText(baseRequest)

      expect(result.translatedText).toBe('こんにちは世界')
      expect(result.error).toBeUndefined()
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          }
        })
      )
    })

    it('should include correct system prompt for different languages', async () => {
      const mockResponse = {
        choices: [{
          message: { content: 'Translated text' }
        }]
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response)

      await translateText({ ...baseRequest, targetLanguage: 'ko' })

      const fetchCall = vi.mocked(global.fetch).mock.calls[0]
      const body = JSON.parse(fetchCall[1]?.body as string)
      
      expect(body.messages[0].content).toContain('Korean')
      expect(body.messages[0].content).toContain('Preserve all HTML placeholders')
    })

    it('should handle API errors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      } as Response)

      const result = await translateText(baseRequest)

      expect(result.translatedText).toBe('')
      expect(result.error).toBe('API request failed: 401 Unauthorized')
    })

    it('should handle network errors', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

      const result = await translateText(baseRequest)

      expect(result.translatedText).toBe('')
      expect(result.error).toBe('Network error')
    })

    it('should handle unknown errors', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce('Unknown error')

      const result = await translateText(baseRequest)

      expect(result.translatedText).toBe('')
      expect(result.error).toBe('Unknown error')
    })

    it('should send correct request parameters', async () => {
      const mockResponse = {
        choices: [{
          message: { content: 'Translation' }
        }]
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response)

      await translateText({
        ...baseRequest,
        text: 'Text with <strong_0>placeholder</strong_0>',
        model: 'gpt-4'
      })

      const fetchCall = vi.mocked(global.fetch).mock.calls[0]
      const body = JSON.parse(fetchCall[1]?.body as string)

      expect(body.model).toBe('gpt-4')
      expect(body.messages[1].content).toBe('Text with <strong_0>placeholder</strong_0>')
      expect(body.temperature).toBe(0.3)
      expect(body.max_tokens).toBe(4000)
    })

    it('should handle custom API endpoints', async () => {
      const mockResponse = {
        choices: [{
          message: { content: 'Translation' }
        }]
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response)

      await translateText({
        ...baseRequest,
        apiEndpoint: 'https://custom.api.com/translate'
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'https://custom.api.com/translate',
        expect.any(Object)
      )
    })

    it('should handle language codes not in predefined list', async () => {
      const mockResponse = {
        choices: [{
          message: { content: 'Translation' }
        }]
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response)

      await translateText({
        ...baseRequest,
        targetLanguage: 'fr' // French not in languageNames
      })

      const fetchCall = vi.mocked(global.fetch).mock.calls[0]
      const body = JSON.parse(fetchCall[1]?.body as string)
      
      expect(body.messages[0].content).toContain('fr') // Should use the code as-is
    })
  })
})