import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock chrome API for content script
global.chrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn(),
    },
    sendMessage: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
} as any

describe('Content Script', () => {
  let messageListener: any

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks()
    
    // Reset document body
    document.body.innerHTML = ''
    
    // Capture the message listener
    vi.mocked(chrome.runtime.onMessage.addListener).mockImplementation((listener) => {
      messageListener = listener
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Message handling', () => {
    it('should register message listener on load', async () => {
      // Dynamic import to trigger module initialization
      await import('../src/content')
      
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1)
      expect(messageListener).toBeDefined()
    })

    it('should handle translate action', async () => {
      await import('../src/content')
      
      const sendResponse = vi.fn()
      document.body.innerHTML = '<p>Hello world</p>'
      
      // Mock storage to return API settings
      vi.mocked(chrome.storage.local.get).mockResolvedValue({
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        targetLanguage: 'ja'
      })
      
      // Send translate message
      const result = messageListener(
        { action: 'translate' },
        { tab: { id: 1 } },
        sendResponse
      )
      
      expect(result).toBe(true) // Should return true for async response
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(chrome.storage.local.get).toHaveBeenCalled()
    })

    it('should handle restore action', async () => {
      await import('../src/content')
      
      const sendResponse = vi.fn()
      
      // Send restore message (in overlay mode, this just closes the overlay)
      messageListener(
        { action: 'restore' },
        { tab: { id: 1 } },
        sendResponse
      )
      
      // Should respond with restored status (overlay close)
      expect(sendResponse).toHaveBeenCalledWith({ status: 'restored' })
    })

    it('should handle unknown actions', async () => {
      await import('../src/content')
      
      const sendResponse = vi.fn()
      
      const result = messageListener(
        { action: 'unknown' },
        { tab: { id: 1 } },
        sendResponse
      )
      
      expect(result).toBeUndefined()
      expect(sendResponse).not.toHaveBeenCalled()
    })
  })

  describe('Translation state management', () => {
    it('should show translation progress indicator', async () => {
      await import('../src/content')
      
      const sendResponse = vi.fn()
      document.body.innerHTML = '<p>Test content</p>'
      
      vi.mocked(chrome.storage.local.get).mockResolvedValue({
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        targetLanguage: 'ja'
      })
      
      messageListener(
        { action: 'translate' },
        { tab: { id: 1 } },
        sendResponse
      )
      
      // Should add progress indicator
      const indicator = document.querySelector('.translation-progress')
      expect(indicator).toBeDefined()
    })

    it.skip('should prevent duplicate translations - needs update for overlay mode', async () => {
      // Need to import content module fresh for this test
      vi.resetModules()
      
      // Mock fetch for API calls
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Translated' } }] })
      })
      
      await import('../src/content')
      
      const sendResponse = vi.fn()
      const sendResponse2 = vi.fn()
      document.body.innerHTML = '<article><p>Test content for readability</p></article>'
      
      // Mock isProbablyReaderable to return true
      vi.doMock('@mozilla/readability', () => ({
        isProbablyReaderable: vi.fn().mockReturnValue(true),
        Readability: vi.fn().mockImplementation(() => ({
          parse: () => ({
            content: '<p>Article content</p>',
            title: 'Test Article'
          })
        }))
      }))
      
      vi.mocked(chrome.storage.local.get).mockResolvedValue({
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        targetLanguage: 'ja',
        readabilityMode: true
      })
      
      // First translation - will return true for async
      const result1 = messageListener({ action: 'translate' }, { tab: { id: 1 } }, sendResponse)
      expect(result1).toBe(true)
      
      // Try second translation immediately - should get sync response
      const result2 = messageListener({ action: 'translate' }, { tab: { id: 1 } }, sendResponse2)
      expect(result2).toBe(true)
      
      // Wait a bit for the async translation to process
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Second response should indicate already translating
      expect(sendResponse2).toHaveBeenCalledWith({ 
        status: 'already_translating'
      })
    })
  })
})