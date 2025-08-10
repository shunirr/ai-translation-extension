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

  it('should use GPT-5 specific parameters for GPT-5 models', async () => {
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
    expect(body.max_tokens).toBe(4000)
    expect(body.temperature).toBe(0.3)
    expect(body.reasoning_effort).toBe('minimal')
    expect(body.verbosity).toBe('low')
  })

  it('should not include GPT-5 parameters for GPT-4 models', async () => {
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
    expect(body.temperature).toBe(0.3)
    expect(body.reasoning_effort).toBeUndefined()
    expect(body.verbosity).toBeUndefined()
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
    expect(body.max_tokens).toBe(4000)
    expect(body.temperature).toBe(0.3)
    expect(body.reasoning_effort).toBe('minimal')
    expect(body.verbosity).toBe('low')
  })

  it('should handle GPT-5-mini model', async () => {
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
      model: 'gpt-5-mini'
    })

    const fetchCall = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse(fetchCall[1]?.body as string)

    expect(body.model).toBe('gpt-5-mini')
    expect(body.reasoning_effort).toBe('minimal')
    expect(body.verbosity).toBe('low')
  })

  it('should handle API error responses with detailed error messages', async () => {
    const errorResponse = {
      error: {
        message: 'Unsupported parameter: max_tokens is not supported',
        type: 'invalid_request_error',
        param: 'max_tokens',
        code: 'unsupported_parameter'
      }
    }

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => errorResponse
    } as Response)

    const result = await translateText({
      text: 'Test text',
      targetLanguage: 'ja',
      apiEndpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: 'test-key',
      model: 'gpt-5-nano'
    })

    expect(result.translatedText).toBe('')
    expect(result.error).toContain('Unsupported parameter: max_tokens is not supported')
  })
})