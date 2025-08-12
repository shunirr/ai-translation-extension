import { describe, it, expect, beforeEach, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import { isReaderable, extractArticleForOverlay } from '../src/readability-adapter'

// Mock @mozilla/readability
vi.mock('@mozilla/readability', () => ({
  isProbablyReaderable: vi.fn(),
  Readability: vi.fn()
}))

describe('Readability Adapter', () => {
  let document: Document

  beforeEach(() => {
    // Create a test document
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <article>
            <h1>Test Article</h1>
            <p>This is a test article with some content.</p>
            <p>It has multiple paragraphs.</p>
          </article>
          <aside>
            <p>This is a sidebar</p>
          </aside>
        </body>
      </html>
    `, {
      url: 'http://example.com',
      contentType: 'text/html'
    })
    
    document = dom.window.document
    
    // Reset mocks
    vi.clearAllMocks()
  })

  describe('isReaderable', () => {
    it('should return true when document is readerable', async () => {
      const { isProbablyReaderable } = await import('@mozilla/readability')
      ;(isProbablyReaderable as any).mockReturnValue(true)
      
      const result = isReaderable(document)
      
      expect(result).toBe(true)
      expect(isProbablyReaderable).toHaveBeenCalledWith(document)
    })
    
    it('should return false when document is not readerable', async () => {
      const { isProbablyReaderable } = await import('@mozilla/readability')
      ;(isProbablyReaderable as any).mockReturnValue(false)
      
      const result = isReaderable(document)
      
      expect(result).toBe(false)
    })
    
    it('should call isProbablyReaderable with document only', async () => {
      const { isProbablyReaderable } = await import('@mozilla/readability')
      ;(isProbablyReaderable as any).mockReturnValue(true)
      
      isReaderable(document)
      
      expect(isProbablyReaderable).toHaveBeenCalledWith(document)
    })
  })
  
  describe('extractArticleForOverlay', () => {
    it('should extract article content for overlay', async () => {
      const { Readability } = await import('@mozilla/readability')
      
      // Mock Readability to return extracted content
      const mockParse = vi.fn().mockReturnValue({
        content: '<p>Article content</p>',
        title: 'Article Title',
        excerpt: 'Article excerpt',
        byline: 'Author Name',
        siteName: 'Site Name'
      })
      
      ;(Readability as any).mockImplementation(() => ({
        parse: mockParse
      }))
      
      const result = extractArticleForOverlay(document)
      
      // Should clone the document
      expect(Readability).toHaveBeenCalled()
      expect(mockParse).toHaveBeenCalled()
      
      // Should return extracted article
      expect(result).toEqual({
        content: '<p>Article content</p>',
        title: 'Article Title',
        excerpt: 'Article excerpt',
        byline: 'Author Name',
        siteName: 'Site Name'
      })
    })
    
    it('should return null when no article content found', async () => {
      const { Readability } = await import('@mozilla/readability')
      
      const mockParse = vi.fn().mockReturnValue(null)
      ;(Readability as any).mockImplementation(() => ({
        parse: mockParse
      }))
      
      const result = extractArticleForOverlay(document)
      
      expect(result).toBeNull()
    })
    
    it('should return null when content is empty', async () => {
      const { Readability } = await import('@mozilla/readability')
      
      const mockParse = vi.fn().mockReturnValue({
        content: '',
        title: 'Title Only'
      })
      ;(Readability as any).mockImplementation(() => ({
        parse: mockParse
      }))
      
      const result = extractArticleForOverlay(document)
      
      expect(result).toBeNull()
    })
    
    it('should handle errors gracefully', async () => {
      const { Readability } = await import('@mozilla/readability')
      
      // Mock Readability to throw an error
      ;(Readability as any).mockImplementation(() => {
        throw new Error('Parsing failed')
      })
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const result = extractArticleForOverlay(document)
      
      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalledWith('Readability: Error extracting article:', expect.any(Error))
      
      consoleErrorSpy.mockRestore()
    })
  })
})