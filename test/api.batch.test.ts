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

describe('API - Batch Translation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should use batch-specific prompt when delimiter is present', async () => {
    const batchText = 'First text\n---DELIMITER---\nSecond text\n---DELIMITER---\nThird text'
    
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: '最初のテキスト\n---DELIMITER---\n二番目のテキスト\n---DELIMITER---\n三番目のテキスト'
          }
        }]
      })
    } as Response)

    await translateText({
      text: batchText,
      targetLanguage: 'ja',
      apiEndpoint: 'https://api.test.com',
      apiKey: 'test-key',
      model: 'test-model'
    })

    // Check the system prompt
    const fetchCall = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(fetchCall[1]?.body as string)
    const systemPrompt = body.messages[0].content

    expect(systemPrompt).toContain('multiple text segments separated by "---DELIMITER---"')
    expect(systemPrompt).toContain('Translate each segment independently')
    expect(systemPrompt).toContain('Preserve the exact delimiter')
  })

  it('should use regular prompt when no delimiter is present', async () => {
    const singleText = 'Just a single text without any delimiter'
    
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: 'デリミタなしの単一のテキスト'
          }
        }]
      })
    } as Response)

    await translateText({
      text: singleText,
      targetLanguage: 'ja',
      apiEndpoint: 'https://api.test.com',
      apiKey: 'test-key',
      model: 'test-model'
    })

    // Check the system prompt
    const fetchCall = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(fetchCall[1]?.body as string)
    const systemPrompt = body.messages[0].content

    expect(systemPrompt).not.toContain('multiple text segments')
    expect(systemPrompt).not.toContain('---DELIMITER---')
    expect(systemPrompt).toContain('Translate the given text')
  })

  it('should handle batch response correctly', async () => {
    const batchText = 'Hello\n---DELIMITER---\nWorld'
    const batchResponse = 'こんにちは\n---DELIMITER---\n世界'
    
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: batchResponse
          }
        }]
      })
    } as Response)

    const result = await translateText({
      text: batchText,
      targetLanguage: 'ja',
      apiEndpoint: 'https://api.test.com',
      apiKey: 'test-key',
      model: 'test-model'
    })

    expect(result.translatedText).toBe(batchResponse)
    expect(result.error).toBeUndefined()
  })

  it('should preserve HTML placeholders in batch mode', async () => {
    const batchText = '<tag_1>Hello</tag_1>\n---DELIMITER---\n<tag_2>World</tag_2>'
    
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: '<tag_1>こんにちは</tag_1>\n---DELIMITER---\n<tag_2>世界</tag_2>'
          }
        }]
      })
    } as Response)

    await translateText({
      text: batchText,
      targetLanguage: 'ja',
      apiEndpoint: 'https://api.test.com',
      apiKey: 'test-key',
      model: 'test-model'
    })

    const fetchCall = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(fetchCall[1]?.body as string)
    const systemPrompt = body.messages[0].content

    expect(systemPrompt).toContain('Preserve all HTML placeholders')
    expect(systemPrompt).toContain('<tag_n>')
  })
})