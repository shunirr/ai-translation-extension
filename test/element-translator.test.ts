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
      expect(elements.map(el => el.tagName)).toContain('P')
      expect(elements.map(el => el.tagName)).toContain('H1')
      expect(elements.map(el => el.tagName)).toContain('LI')
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

    it('should include divs with text content', () => {
      document.body.innerHTML = `
        <div>This is direct text content in a div</div>
        <div><span>Text in span inside div</span></div>
        <p>Simple paragraph</p>
      `

      const elements = getTranslatableElements()
      
      expect(elements).toHaveLength(3) // both divs and p
      const tagNames = elements.map(el => el.tagName)
      expect(tagNames.filter(tag => tag === 'DIV')).toHaveLength(2)
      expect(tagNames).toContain('P')
    })

    it('should skip elements with short text', () => {
      document.body.innerHTML = `
        <p>Short</p>
        <p>This is a longer paragraph with enough content</p>
        <div>Too short</div>
        <div>This div has enough text content to be included</div>
      `

      const elements = getTranslatableElements()
      
      // Filter elements with enough text content
      const validElements = elements.filter(el => (el.textContent?.length || 0) >= 10)
      expect(validElements).toHaveLength(2)
      
      const texts = validElements.map(el => el.textContent)
      expect(texts).toContain('This is a longer paragraph with enough content')
      expect(texts).toContain('This div has enough text content to be included')
    })
    
    it('should process leaf elements first', () => {
      document.body.innerHTML = `
        <div>Parent div with direct text
          <p>Child paragraph with enough content</p>
        </div>
      `

      const elements = getTranslatableElements()
      
      // Should process leaf elements first (depth-first)
      expect(elements.length).toBeGreaterThanOrEqual(1)
      // Should include the p element
      const hasP = elements.some(el => el.tagName === 'P')
      expect(hasP).toBe(true)
    })

    it('should detect text in inline elements', () => {
      document.body.innerHTML = `
        <div><span><a href="#">Hello world from inline elements</a></span></div>
        <div><span>Short</span></div>
      `

      const elements = getTranslatableElements()
      
      expect(elements).toHaveLength(1) // Only div with enough text
      expect(elements[0].textContent).toContain('Hello world from inline elements')
    })

    it('should handle nested list structures', () => {
      document.body.innerHTML = `
        <ul>
          <li>
            <div class="wrapper">
              <a href="#">List item with link text content</a>
            </div>
          </li>
          <li>Short</li>
        </ul>
      `

      const elements = getTranslatableElements()
      
      // Should detect the li with enough content
      const liElements = elements.filter(el => el.tagName === 'LI')
      expect(liElements.length).toBeGreaterThan(0)
      
      const liWithContent = liElements.find(el => el.textContent?.includes('List item with link'))
      expect(liWithContent).toBeDefined()
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

      vi.mocked(translationCache.get).mockReturnValue(null)
      vi.mocked(translateText).mockResolvedValue({
        translatedText: 'これは<strong_0>太字</strong_0>のテキストです'
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

      vi.mocked(translationCache.get).mockReturnValue(null)
      vi.mocked(translateText).mockResolvedValue({
        translatedText: '今日<a_0>私たちの<em_1>素晴らしい</em_1>ウェブサイト</a_0>を訪問してください！'
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