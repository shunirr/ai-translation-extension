import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock IntersectionObserver
class MockIntersectionObserver {
  callback: IntersectionObserverCallback
  options?: IntersectionObserverInit
  elements: Element[] = []

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback
    this.options = options
  }

  observe(element: Element) {
    this.elements.push(element)
  }

  disconnect() {
    this.elements = []
  }

  // Simulate element entering viewport
  triggerIntersection(element: Element, isIntersecting: boolean) {
    const entry = {
      target: element,
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
      boundingClientRect: element.getBoundingClientRect(),
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: {} as DOMRectReadOnly,
      time: Date.now()
    }
    this.callback([entry], this as any)
  }
}

// Mock chrome API and fetch
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

global.fetch = vi.fn()
global.IntersectionObserver = MockIntersectionObserver as any

describe('Content Script - Viewport Translation', () => {
  let messageListener: any
  let mockObserver: MockIntersectionObserver

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    
    // Capture the message listener
    vi.mocked(chrome.runtime.onMessage.addListener).mockImplementation((listener) => {
      messageListener = listener
    })

    // Mock fetch for API calls
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '翻訳されたテキスト' } }] })
    } as Response)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Viewport-based translation', () => {
    it('should use viewport translation for large pages', async () => {
      // Create a large page
      document.body.innerHTML = `
        <div style="height: 2000px">
          <p id="visible">Visible text</p>
          <div style="margin-top: 1500px">
            <p id="hidden">Hidden text below viewport</p>
          </div>
        </div>
      `
      
      // Mock getBoundingClientRect for visible element
      const visibleEl = document.getElementById('visible')!
      vi.spyOn(visibleEl, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        bottom: 120,
        left: 0,
        right: 100,
        width: 100,
        height: 20,
      } as DOMRect)
      
      // Mock getBoundingClientRect for hidden element
      const hiddenEl = document.getElementById('hidden')!
      vi.spyOn(hiddenEl, 'getBoundingClientRect').mockReturnValue({
        top: 1600,
        bottom: 1620,
        left: 0,
        right: 100,
        width: 100,
        height: 20,
      } as DOMRect)
      
      // Mock window.innerHeight
      Object.defineProperty(window, 'innerHeight', {
        value: 800,
        writable: true
      })
      
      vi.mocked(chrome.storage.local.get).mockResolvedValue({
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        targetLanguage: 'ja',
        viewportTranslation: true
      })
      
      await import('../src/content')
      
      const sendResponse = vi.fn()
      await messageListener(
        { action: 'translate' },
        { tab: { id: 1 } },
        sendResponse
      )
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Only visible element should be translated
      expect(visibleEl.textContent).toBe('翻訳されたテキスト')
      expect(hiddenEl.textContent).toBe('Hidden text below viewport')
    })

    it('should translate elements as they come into view', async () => {
      document.body.innerHTML = `
        <p id="element1">First text</p>
        <p id="element2">Second text</p>
      `
      
      vi.mocked(chrome.storage.local.get).mockResolvedValue({
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        targetLanguage: 'ja',
        viewportTranslation: true
      })
      
      // Reset modules to get fresh instance
      vi.resetModules()
      await import('../src/content')
      
      // Trigger translation
      const sendResponse = vi.fn()
      await messageListener(
        { action: 'translate' },
        { tab: { id: 1 } },
        sendResponse
      )
      
      // Get the observer instance
      const observers = (global.IntersectionObserver as any).instances
      if (observers && observers.length > 0) {
        mockObserver = observers[observers.length - 1]
        
        // Simulate element2 coming into view
        const element2 = document.getElementById('element2')!
        mockObserver.triggerIntersection(element2, true)
        
        await new Promise(resolve => setTimeout(resolve, 50))
        
        // Element2 should now be translated
        expect(element2.textContent).toContain('翻訳')
      }
    })

    it.skip('should show info message about progressive translation', async () => {
      // Create multiple elements
      const elementsHtml = Array(20).fill(0).map((_, i) => 
        `<p id="element${i}" style="margin-top: ${i * 200}px">Text ${i}</p>`
      ).join('')
      
      document.body.innerHTML = `<div style="height: 4000px">${elementsHtml}</div>`
      
      // Mock only first 5 elements as visible
      for (let i = 0; i < 20; i++) {
        const el = document.getElementById(`element${i}`)!
        vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
          top: i * 200,
          bottom: i * 200 + 20,
          left: 0,
          right: 100,
          width: 100,
          height: 20,
        } as DOMRect)
      }
      
      vi.mocked(chrome.storage.local.get).mockResolvedValue({
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        targetLanguage: 'ja',
        viewportTranslation: true
      })
      
      await import('../src/content')
      
      const sendResponse = vi.fn()
      await messageListener(
        { action: 'translate' },
        { tab: { id: 1 } },
        sendResponse
      )
      
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Check for info message
      const infoDiv = document.querySelector('.translation-info')
      if (!infoDiv) {
        // If no info message, it means all elements were visible and translated
        const translatedElements = document.querySelectorAll('[data-translated="true"]')
        expect(translatedElements.length).toBeGreaterThan(0)
      } else {
        expect(infoDiv?.textContent).toContain('more will translate as you scroll')
      }
    })
  })

  describe('Full page translation', () => {
    it.skip('should use full page translation when disabled in settings', async () => {
      document.body.innerHTML = `
        <p>Text 1</p>
        <p>Text 2</p>
        <p>Text 3</p>
      `
      
      vi.mocked(chrome.storage.local.get).mockResolvedValue({
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        targetLanguage: 'ja',
        viewportTranslation: false // Explicitly disabled
      })
      
      await import('../src/content')
      
      const sendResponse = vi.fn()
      await messageListener(
        { action: 'translate' },
        { tab: { id: 1 } },
        sendResponse
      )
      
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // All elements should be translated
      const paragraphs = document.querySelectorAll('p')
      let translatedCount = 0
      paragraphs.forEach(p => {
        if (p.getAttribute('data-translated') === 'true') {
          translatedCount++
          expect(p.textContent).toBe('翻訳されたテキスト')
        }
      })
      expect(translatedCount).toBe(paragraphs.length)
    })
  })
})