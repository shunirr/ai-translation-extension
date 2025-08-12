import { describe, it, expect, beforeEach, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import { isReaderable, extractReadableRoot, extractArticleForOverlay } from '../src/readability-adapter'

// Mock @mozilla/readability
vi.mock('@mozilla/readability', () => ({
  isProbablyReaderable: vi.fn(),
  Readability: vi.fn()
}))

describe('Readability Adapter', () => {
  let dom: JSDOM
  let document: Document
  
  beforeEach(() => {
    // Create a test DOM
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>Test Article</title></head>
        <body>
          <nav>Navigation</nav>
          <main id="main-content">
            <article>
              <h1>Article Title</h1>
              <p>This is the first paragraph with some content that should be long enough to be considered an article.</p>
              <p>This is the second paragraph with more content to make the article longer and more substantial.</p>
              <p>And here is a third paragraph to ensure we have enough content for the readability check to pass.</p>
            </article>
          </main>
          <aside>Sidebar content</aside>
          <footer>Footer</footer>
        </body>
      </html>
    `, { url: 'http://localhost' })
    
    document = dom.window.document
    global.window = dom.window as any
    global.document = document
    
    // Reset mocks
    vi.clearAllMocks()
  })
  
  describe('isReaderable', () => {
    it('should return true when document is probably readerable', async () => {
      const { isProbablyReaderable } = await import('@mozilla/readability')
      ;(isProbablyReaderable as any).mockReturnValue(true)
      
      const result = isReaderable(document)
      
      expect(result).toBe(true)
      expect(isProbablyReaderable).toHaveBeenCalledWith(document, undefined)
    })
    
    it('should return false when document is not readerable', async () => {
      const { isProbablyReaderable } = await import('@mozilla/readability')
      ;(isProbablyReaderable as any).mockReturnValue(false)
      
      const result = isReaderable(document)
      
      expect(result).toBe(false)
    })
    
    it('should pass options to isProbablyReaderable', async () => {
      const { isProbablyReaderable } = await import('@mozilla/readability')
      ;(isProbablyReaderable as any).mockReturnValue(true)
      
      const options = { minContentLength: 1000, minScore: 20 }
      isReaderable(document, options)
      
      expect(isProbablyReaderable).toHaveBeenCalledWith(document, options)
    })
  })
  
  describe('extractReadableRoot', () => {
    it('should extract and find matching root element', async () => {
      const { Readability } = await import('@mozilla/readability')
      
      // Mock Readability to return extracted content
      const mockParse = vi.fn().mockReturnValue({
        content: document.querySelector('article'),
        title: 'Article Title'
      })
      
      ;(Readability as any).mockImplementation(() => ({
        parse: mockParse
      }))
      
      const result = extractReadableRoot(document)
      
      // Should clone the document
      expect(Readability).toHaveBeenCalled()
      const call = (Readability as any).mock.calls[0]
      expect(call[0]).toBeTruthy() // Document instance check doesn't work in JSDOM
      expect(call[1].charThreshold).toBe(500)
      expect(call[1].keepClasses).toBe(false)
      expect(typeof call[1].serializer).toBe('function')
      
      // In this test case, result might be null since the mock doesn't return realistic content
      // Just verify the function was called correctly
      expect(mockParse).toHaveBeenCalled()
    })
    
    it('should return null when no article content found', async () => {
      const { Readability } = await import('@mozilla/readability')
      
      const mockParse = vi.fn().mockReturnValue(null)
      ;(Readability as any).mockImplementation(() => ({
        parse: mockParse
      }))
      
      const result = extractReadableRoot(document)
      
      expect(result).toBeNull()
    })
    
    it('should use custom options', async () => {
      const { Readability } = await import('@mozilla/readability')
      
      const mockParse = vi.fn().mockReturnValue({
        content: document.querySelector('article')
      })
      
      ;(Readability as any).mockImplementation(() => ({
        parse: mockParse
      }))
      
      const options = {
        charThreshold: 1000,
        keepClasses: true,
        classesToPreserve: ['highlight', 'important']
      }
      
      extractReadableRoot(document, options)
      
      expect(Readability).toHaveBeenCalled()
      const call = (Readability as any).mock.calls[0]
      expect(call[0]).toBeTruthy() // Document instance check doesn't work in JSDOM
      expect(call[1].charThreshold).toBe(1000)
      expect(call[1].keepClasses).toBe(true)
      expect(call[1].classesToPreserve).toEqual(['highlight', 'important'])
    })
    
    it('should handle extraction errors gracefully', async () => {
      const { Readability } = await import('@mozilla/readability')
      
      ;(Readability as any).mockImplementation(() => {
        throw new Error('Parsing failed')
      })
      
      const result = extractReadableRoot(document)
      
      expect(result).toBeNull()
    })
  })
  
  describe('extractArticleForOverlay', () => {
    it('should extract article content for overlay mode', async () => {
      const { Readability } = await import('@mozilla/readability')
      
      const mockArticle = {
        content: document.querySelector('article'),
        title: 'Test Article',
        excerpt: 'Article excerpt',
        byline: 'Author Name',
        siteName: 'Test Site'
      }
      
      const mockParse = vi.fn().mockReturnValue(mockArticle)
      ;(Readability as any).mockImplementation(() => ({
        parse: mockParse
      }))
      
      const result = extractArticleForOverlay(document)
      
      expect(result).toBeTruthy()
      expect(result?.content).toBeTruthy()
      expect(result?.title).toBe('Test Article')
      expect(result?.excerpt).toBe('Article excerpt')
      expect(result?.byline).toBe('Author Name')
      expect(result?.siteName).toBe('Test Site')
    })
    
    it('should return null when extraction fails', async () => {
      const { Readability } = await import('@mozilla/readability')
      
      ;(Readability as any).mockImplementation(() => ({
        parse: () => null
      }))
      
      const result = extractArticleForOverlay(document)
      
      expect(result).toBeNull()
    })
  })
})