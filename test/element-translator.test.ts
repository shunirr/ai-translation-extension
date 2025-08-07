import { describe, it, expect, vi, beforeEach } from 'vitest'
import { translateElement, getTranslatableElements } from '../src/element-translator'
import { translateText } from '../src/api'
import { translationCache } from '../src/cache'

// Mock dependencies
vi.mock('../src/api')
vi.mock('../src/cache')

describe('Element Translator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    translationCache.clear()
  })

  describe('getTranslatableElements', () => {
    it('should find translatable elements', () => {
      document.body.innerHTML = `
        <p>This is a paragraph</p>
        <h1>This is a heading</h1>
        <li>This is a list item</li>
        <button>This is a button</button>
        <nav>Navigation</nav>
      `

      const elements = getTranslatableElements()
      
      expect(elements).toHaveLength(3) // p, h1, li (not button or nav)
      expect(elements[0].tagName).toBe('P')
      expect(elements[1].tagName).toBe('H1')
      expect(elements[2].tagName).toBe('LI')
    })

    it('should skip already translated elements', () => {
      document.body.innerHTML = `
        <p data-translated="true">Already translated</p>
        <p data-original-html="original">Has original</p>
        <p>Not yet translated</p>
      `

      const elements = getTranslatableElements()
      
      expect(elements).toHaveLength(1)
      expect(elements[0].textContent).toBe('Not yet translated')
    })

    it('should skip elements with nested block elements', () => {
      document.body.innerHTML = `
        <div>
          <p>Nested paragraph</p>
        </div>
        <p>Simple paragraph</p>
      `

      const elements = getTranslatableElements()
      
      expect(elements).toHaveLength(2) // Both paragraphs, but not the div
    })

    it('should skip elements with short text', () => {
      document.body.innerHTML = `
        <p>Short</p>
        <p>This is a longer paragraph with enough content</p>
      `

      const elements = getTranslatableElements()
      
      expect(elements).toHaveLength(1)
      expect(elements[0].textContent).toContain('longer paragraph')
    })
  })

  describe('translateElement', () => {
    const settings = {
      apiEndpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: 'test-key',
      model: 'gpt-3.5-turbo',
      targetLanguage: 'Japanese'
    }

    it('should translate element with HTML content', async () => {
      const element = document.createElement('p')
      element.innerHTML = 'This is <strong>bold</strong> text'
      document.body.appendChild(element)

      vi.mocked(translateText).mockResolvedValue({
        translatedText: 'これは<strong_0>太字</strong_0>のテキストです',
        error: null
      })
      vi.mocked(translationCache.set).mockImplementation(() => {})

      await translateElement(element, settings)

      expect(element.innerHTML).toContain('<strong>')
      expect(element.innerHTML).toContain('太字')
      expect(element.innerHTML).toContain('のテキストです')
      expect(element.getAttribute('data-translated')).toBe('true')
      expect(element.getAttribute('data-original-html')).toBe('This is <strong>bold</strong> text')
    })

    it('should use cached translation if available', async () => {
      const element = document.createElement('p')
      element.innerHTML = 'Hello world'
      document.body.appendChild(element)

      vi.mocked(translationCache.get).mockReturnValue('こんにちは世界')
      vi.mocked(translationCache.set).mockImplementation(() => {})

      await translateElement(element, settings)

      expect(vi.mocked(translateText)).not.toHaveBeenCalled()
      expect(element.innerHTML).toBe('こんにちは世界')
    })

    it('should skip already translated elements', async () => {
      const element = document.createElement('p')
      element.innerHTML = 'Already done'
      element.setAttribute('data-translated', 'true')
      document.body.appendChild(element)

      await translateElement(element, settings)

      expect(vi.mocked(translateText)).not.toHaveBeenCalled()
      expect(element.innerHTML).toBe('Already done')
    })

    it('should handle complex HTML with multiple tags', async () => {
      const element = document.createElement('p')
      element.innerHTML = 'Visit <a href="#" class="link">our <em>amazing</em> website</a> today!'
      document.body.appendChild(element)

      vi.mocked(translateText).mockResolvedValue({
        translatedText: '今日<a_0>私たちの<em_1>素晴らしい</em_1>ウェブサイト</a_0>を訪問してください！',
        error: null
      })
      vi.mocked(translationCache.set).mockImplementation(() => {})

      await translateElement(element, settings)

      expect(element.innerHTML).toContain('<a')
      expect(element.innerHTML).toContain('href="#"')
      expect(element.innerHTML).toContain('<em>')
      expect(element.innerHTML).toContain('素晴らしい')
    })
  })
})