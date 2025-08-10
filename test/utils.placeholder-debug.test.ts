import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { placeholdersToHtml } from '../src/utils'

describe('Placeholder Debug Logging', () => {
  let debugSpy: any
  
  beforeEach(() => {
    // Spy on console.debug instead of console.warn/error
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
  })
  
  afterEach(() => {
    debugSpy.mockRestore()
  })
  
  describe('placeholdersToHtml debug logging', () => {
    it('should log debug message for unmatched placeholders', () => {
      const map = new Map([
        ['<strong_0>', '<strong>'],
        ['</strong_0>', '</strong>']
      ])
      
      // Text with mismatched placeholder (strong_1 instead of strong_0)
      const text = 'This is <strong_1>bold</strong_1> text'
      const result = placeholdersToHtml(text, map)
      
      // Should have logged debug messages
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unmatched placeholder <strong_1>')
      )
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unmatched placeholder </strong_1>')
      )
      
      // Result should still have proper HTML structure
      expect(result).toContain('<strong>')
      expect(result).toContain('</strong>')
      expect(result).toContain('bold')
    })
    
    it('should not log warnings when placeholders match correctly', () => {
      const map = new Map([
        ['<em_0>', '<em>'],
        ['</em_0>', '</em>']
      ])
      
      const text = 'This is <em_0>emphasized</em_0> text'
      const result = placeholdersToHtml(text, map)
      
      // Should not have logged any debug messages
      expect(debugSpy).not.toHaveBeenCalled()
      
      // Result should be correct
      expect(result).toBe('This is <em>emphasized</em> text')
    })
    
    it('should handle tag_N format placeholders that API might return', () => {
      const map = new Map([
        ['<span_0>', '<span class="highlight">'],
        ['</span_0>', '</span>']
      ])
      
      // API might return tag_0, tag_1, etc. instead of span_0
      const text = 'This is <tag_0>highlighted</tag_0> text'
      const result = placeholdersToHtml(text, map)
      
      // Should log debug about unmatched placeholders
      expect(debugSpy).toHaveBeenCalled()
      
      // Should still produce valid output
      expect(result).toBeTruthy()
      expect(result).toContain('highlighted')
    })
    
    it('should log debug for complex nested mismatches', () => {
      const map = new Map([
        ['<div_0>', '<div class="container">'],
        ['</div_0>', '</div>'],
        ['<span_1>', '<span>'],
        ['</span_1>', '</span>']
      ])
      
      // Mismatched numbers in translation
      const text = '<div_2>Content with <span_3>nested</span_3> tags</div_2>'
      const result = placeholdersToHtml(text, map)
      
      // Should have logged multiple debug messages
      expect(debugSpy.mock.calls.length).toBeGreaterThan(0)
      
      // Result should still be somewhat valid
      expect(result).toContain('Content')
      expect(result).toContain('nested')
    })
    
    it('should not produce console errors for production use', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const map = new Map([
        ['<p_0>', '<p>'],
        ['</p_0>', '</p>']
      ])
      
      // Completely different placeholder
      const text = '<tag_99>Paragraph</tag_99>'
      placeholdersToHtml(text, map)
      
      // Should not have logged errors or warnings
      expect(errorSpy).not.toHaveBeenCalled()
      expect(warnSpy).not.toHaveBeenCalled()
      
      // Debug logging should be used instead
      expect(debugSpy).toHaveBeenCalled()
      
      errorSpy.mockRestore()
      warnSpy.mockRestore()
    })
  })
})