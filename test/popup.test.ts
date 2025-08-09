import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock chrome API
global.chrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
} as any

// Mock DOM elements
const mockElements = {
  apiEndpoint: { value: '', addEventListener: vi.fn() } as any,
  apiKey: { value: '', addEventListener: vi.fn() } as any,
  model: { value: '', addEventListener: vi.fn() } as any,
  targetLanguage: { value: 'Japanese', addEventListener: vi.fn() } as any,
  apiRps: { value: '0.9', addEventListener: vi.fn() } as any,
  batchSize: { value: '2000', addEventListener: vi.fn() } as any,
  viewportTranslation: { checked: true, addEventListener: vi.fn() } as any,
  saveSettings: { addEventListener: vi.fn() } as any,
  translatePage: { addEventListener: vi.fn() } as any,
  restorePage: { addEventListener: vi.fn() } as any,
  status: { textContent: '', className: 'status' } as HTMLDivElement,
}

// Mock document.getElementById
document.getElementById = vi.fn((id: string) => {
  const map: Record<string, any> = {
    'api-endpoint': mockElements.apiEndpoint,
    'api-key': mockElements.apiKey,
    'model': mockElements.model,
    'target-language': mockElements.targetLanguage,
    'api-rps': mockElements.apiRps,
    'batch-size': mockElements.batchSize,
    'viewport-translation': mockElements.viewportTranslation,
    'save-settings': mockElements.saveSettings,
    'translate-page': mockElements.translatePage,
    'restore-page': mockElements.restorePage,
    'status': mockElements.status,
  }
  return map[id] || null
})

describe('Popup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock element values
    mockElements.apiEndpoint.value = ''
    mockElements.apiKey.value = ''
    mockElements.model.value = ''
    mockElements.targetLanguage.value = 'ja'
    mockElements.apiRps.value = '0.9'
    mockElements.batchSize.value = '2000'
    mockElements.viewportTranslation.checked = true
    mockElements.status.textContent = ''
    mockElements.status.className = 'status'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Settings loading', () => {
    it('should load saved settings on popup open', async () => {
      const savedSettings = {
        apiEndpoint: 'https://custom.api.com',
        apiKey: 'test-key-123',
        model: 'gpt-4',
        targetLanguage: 'English'
      }
      
      vi.mocked(chrome.storage.local.get).mockResolvedValue(savedSettings)
      
      // Import popup to trigger initialization
      await import('../src/popup')
      
      // Wait for async loading
      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(chrome.storage.local.get).toHaveBeenCalledWith([
        'apiEndpoint',
        'apiKey',
        'model',
        'targetLanguage',
        'apiRps',
        'batchSize',
        'viewportTranslation'
      ])
      
      expect(mockElements.apiEndpoint.value).toBe('https://custom.api.com')
      expect(mockElements.apiKey.value).toBe('test-key-123')
      expect(mockElements.model.value).toBe('gpt-4')
      expect(mockElements.targetLanguage.value).toBe('English')
    })

    it('should use defaults for missing settings', async () => {
      vi.mocked(chrome.storage.local.get).mockResolvedValue({})
      
      await import('../src/popup')
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // Values should remain empty/default
      expect(mockElements.apiEndpoint.value).toBe('')
      expect(mockElements.apiKey.value).toBe('')
      expect(mockElements.model.value).toBe('')
      expect(mockElements.targetLanguage.value).toBe('ja')
    })
  })

  describe('Settings saving', () => {
    it('should save settings when save button is clicked', async () => {
      await import('../src/popup')
      
      // Set input values
      mockElements.apiEndpoint.value = 'https://new.api.com'
      mockElements.apiKey.value = 'new-key'
      mockElements.model.value = 'gpt-4'
      mockElements.targetLanguage.value = 'Japanese'
      
      // Simulate click
      mockElements.saveSettings.click?.()
      
      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        apiEndpoint: 'https://new.api.com',
        apiKey: 'new-key',
        model: 'gpt-4',
        targetLanguage: 'Japanese',
        apiRps: 0.9,
        batchSize: 2000,
        viewportTranslation: true
      })
      
      expect(mockElements.status.className).toContain('success')
      expect(mockElements.status.textContent).toContain('Settings saved')
    })

    it('should use defaults for empty values', async () => {
      await import('../src/popup')
      
      // Leave inputs empty
      mockElements.apiEndpoint.value = ''
      mockElements.apiKey.value = 'some-key'
      mockElements.model.value = ''
      
      mockElements.saveSettings.click?.()
      
      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'some-key',
        model: 'gpt-4.1-mini',
        targetLanguage: 'ja',
        apiRps: 0.9,
        batchSize: 2000,
        viewportTranslation: true
      })
    })
  })

  describe('Translation actions', () => {
    it('should send translate message when translate button is clicked', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 123 }] as any)
      
      await import('../src/popup')
      
      // Mock window.close
      window.close = vi.fn()
      
      mockElements.translatePage.click?.()
      
      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(chrome.tabs.query).toHaveBeenCalledWith({ 
        active: true, 
        currentWindow: true 
      })
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(123, { 
        action: 'translate' 
      })
      expect(mockElements.status.className).toContain('info')
      expect(window.close).toHaveBeenCalled()
    })

    it('should send restore message when restore button is clicked', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 456 }] as any)
      
      await import('../src/popup')
      
      window.close = vi.fn()
      
      mockElements.restorePage.click?.()
      
      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(456, { 
        action: 'restore' 
      })
      expect(mockElements.status.className).toContain('success')
      expect(mockElements.status.textContent).toContain('Page restored')
      expect(window.close).toHaveBeenCalled()
    })
  })
})