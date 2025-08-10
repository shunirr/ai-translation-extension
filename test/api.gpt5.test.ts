import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { translateText } from '../src/api'

// Mock fetch
global.fetch = vi.fn()

// Mock RateLimiter
vi.mock('../src/rate-limiter', () => ({
  RateLimiter: vi.fn().mockImplementation(() => ({
    execute: vi.fn((fn) => fn()),
    updateRPS: vi.fn()
  }))
}))

describe('API - GPT-5 Compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should use max_completion_tokens for GPT-5 models', async () => {
    const mockResponse = {
      choices: [{
        message: { content: 'Translated text' }
      }]
    }

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    } as Response)

    await translateText({
      text: 'Test text',
      targetLanguage: 'ja',
      apiEndpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: 'test-key',
      model: 'gpt-5-nano'
    })

    const fetchCall = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse(fetchCall[1]?.body as string)

    expect(body.model).toBe('gpt-5-nano')
    expect(body.max_completion_tokens).toBe(4000)
    expect(body.max_tokens).toBeUndefined()
    expect(body.temperature).toBeUndefined() // GPT-5 doesn't support custom temperature
  })

  it('should use max_tokens for GPT-4 models', async () => {
    const mockResponse = {
      choices: [{
        message: { content: 'Translated text' }
      }]
    }

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    } as Response)

    await translateText({
      text: 'Test text',
      targetLanguage: 'ja',
      apiEndpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: 'test-key',
      model: 'gpt-4'
    })

    const fetchCall = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse(fetchCall[1]?.body as string)

    expect(body.model).toBe('gpt-4')
    expect(body.max_tokens).toBe(4000)
    expect(body.max_completion_tokens).toBeUndefined()
    expect(body.temperature).toBe(0.3) // GPT-4 supports custom temperature
  })

  it('should handle GPT-5-turbo model variant', async () => {
    const mockResponse = {
      choices: [{
        message: { content: 'Translated text' }
      }]
    }

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    } as Response)

    await translateText({
      text: 'Test text',
      targetLanguage: 'ja',
      apiEndpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: 'test-key',
      model: 'GPT-5-Turbo'  // Test case insensitive
    })

    const fetchCall = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse(fetchCall[1]?.body as string)

    expect(body.model).toBe('GPT-5-Turbo')
    expect(body.max_completion_tokens).toBe(4000)
    expect(body.max_tokens).toBeUndefined()
    expect(body.temperature).toBeUndefined() // GPT-5 doesn't support custom temperature
  })
})