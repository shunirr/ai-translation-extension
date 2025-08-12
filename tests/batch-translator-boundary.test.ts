// Test for batch boundary handling in BatchTranslator
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BatchTranslator } from '../src/batch-translator'

// Mock dependencies
vi.mock('../src/cache', () => ({
  translationCache: {
    get: vi.fn().mockReturnValue(null),
    set: vi.fn()
  }
}))

vi.mock('../src/api', () => ({
  translateText: vi.fn()
}))

vi.mock('../src/utils', () => ({
  htmlToPlaceholders: vi.fn((html) => ({
    text: html.replace(/<[^>]*>/g, ''), // Simple HTML strip for testing
    map: new Map()
  })),
  placeholdersToHtml: vi.fn((text) => text)
}))

describe('BatchTranslator - Element Boundary Handling', () => {
  let translator: BatchTranslator
  
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  it('should keep complete elements together in batches', async () => {
    // Create translator with 500 character limit
    translator = new BatchTranslator({
      maxCharactersPerBatch: 500,
      batchDelimiter: '\n---DELIMITER---\n'
    })
    
    // Create test elements with varying sizes
    const elements = [
      createMockElement('Short paragraph 1. About 30 chars.'), // ~30 chars
      createMockElement('Medium paragraph 2. This one is a bit longer and contains more text to simulate a typical paragraph. Around 120 characters total.'), // ~120 chars
      createMockElement('Another medium paragraph 3. This paragraph also contains a decent amount of text, similar to what you might find in an article. About 150 characters here.'), // ~150 chars
      createMockElement('Short paragraph 4. Just 35 chars.'), // ~35 chars
      createMockElement('Final paragraph 5. This is the last one with moderate length text that should fit nicely into our batching system. Approximately 130 characters.'), // ~130 chars
    ]
    
    // Mock the API response
    const { translateText } = await import('../src/api')
    const mockTranslate = vi.mocked(translateText)
    
    // Track how batches are created
    const batchCalls: string[][] = []
    mockTranslate.mockImplementation(async (params) => {
      const texts = params.text.split('\n---DELIMITER---\n')
      batchCalls.push(texts)
      return {
        translatedText: texts.map(t => `Translated: ${t}`).join('\n---DELIMITER---\n')
      }
    })
    
    // Process elements
    await translator.translateElements(elements, {
      apiEndpoint: 'test',
      apiKey: 'test',
      model: 'test',
      targetLanguage: 'Japanese'
    })
    
    // Verify batching behavior
    console.log('Batch calls:', batchCalls)
    
    // With 500 char limit:
    // Batch 1: Elements 0, 1, 2, 3 (30 + 17 + 120 + 17 + 150 + 17 + 35 = 386 chars)
    // Batch 2: Element 4 (130 chars)
    expect(batchCalls.length).toBe(2)
    expect(batchCalls[0].length).toBe(4) // First batch has 4 elements
    expect(batchCalls[1].length).toBe(1) // Second batch has 1 element
  })
  
  it('should handle elements that exceed max batch size', async () => {
    // Create translator with small limit
    translator = new BatchTranslator({
      maxCharactersPerBatch: 100,
      batchDelimiter: '\n---DELIMITER---\n'
    })
    
    // Create elements including one that exceeds the limit
    const elements = [
      createMockElement('Small text.'), // ~11 chars
      createMockElement('This is a very long paragraph that exceeds our 100 character limit. It contains enough text to go over the threshold and should be split into chunks.'), // ~152 chars
      createMockElement('Another small one.'), // ~18 chars
    ]
    
    const { translateText } = await import('../src/api')
    const mockTranslate = vi.mocked(translateText)
    
    const batchCalls: string[][] = []
    mockTranslate.mockImplementation(async (params) => {
      const texts = params.text.split('\n---DELIMITER---\n')
      batchCalls.push(texts)
      return {
        translatedText: texts.map(t => `Translated: ${t}`).join('\n---DELIMITER---\n')
      }
    })
    
    // Spy on console.warn
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    await translator.translateElements(elements, {
      apiEndpoint: 'test',
      apiKey: 'test',
      model: 'test',
      targetLanguage: 'Japanese'
    })
    
    // Should create 4 batches: small, chunk1, chunk2, small
    expect(batchCalls.length).toBe(4)
    expect(batchCalls[0].length).toBe(1) // First small element
    expect(batchCalls[1].length).toBe(1) // First chunk of oversized element
    expect(batchCalls[2].length).toBe(1) // Second chunk of oversized element
    expect(batchCalls[3].length).toBe(1) // Last small element
    
    // Should have warned about oversized element
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Element exceeds max batch size'))
    
    // Verify that each chunk is under the limit
    batchCalls.forEach(batch => {
      batch.forEach(text => {
        expect(text.length).toBeLessThanOrEqual(100)
      })
    })
    
    warnSpy.mockRestore()
  })
  
  it('should not split elements mid-sentence', async () => {
    translator = new BatchTranslator({
      maxCharactersPerBatch: 200,
      batchDelimiter: '\n---DELIMITER---\n'
    })
    
    // Create elements with full sentences
    const elements = [
      createMockElement('This is the first sentence. And this is the second sentence in the same paragraph.'), // ~83 chars
      createMockElement('Here is another paragraph. It also has multiple sentences. Each one is complete.'), // ~81 chars
      createMockElement('Final paragraph here. With its own sentences.'), // ~46 chars
    ]
    
    const { translateText } = await import('../src/api')
    const mockTranslate = vi.mocked(translateText)
    
    const batchCalls: string[][] = []
    mockTranslate.mockImplementation(async (params) => {
      const texts = params.text.split('\n---DELIMITER---\n')
      batchCalls.push(texts)
      
      // Verify no text is cut mid-sentence
      texts.forEach(text => {
        // Check that each text ends with proper punctuation
        const trimmed = text.trim()
        if (trimmed) {
          const lastChar = trimmed[trimmed.length - 1]
          expect(['.', '!', '?']).toContain(lastChar)
        }
      })
      
      return {
        translatedText: texts.map(t => `Translated: ${t}`).join('\n---DELIMITER---\n')
      }
    })
    
    await translator.translateElements(elements, {
      apiEndpoint: 'test',
      apiKey: 'test',
      model: 'test',
      targetLanguage: 'Japanese'
    })
    
    // Elements 1 and 2 fit in first batch (83 + 17 + 81 = 181 chars)
    // Element 3 goes to second batch
    expect(batchCalls.length).toBe(2)
    expect(batchCalls[0].length).toBe(2)
    expect(batchCalls[1].length).toBe(1)
  })
})

// Helper function to create mock DOM elements
function createMockElement(innerHTML: string): Element {
  const element = document.createElement('p')
  element.innerHTML = innerHTML
  return element
}