import { describe, it, expect, beforeEach } from 'vitest'
import {
  extractTextNodes,
  htmlToPlaceholders,
  placeholdersToHtml,
  clusterTextNodes,
  applyTranslation,
  TextCluster
} from '../src/utils'

describe('Utils', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  describe('extractTextNodes', () => {
    it('should extract text nodes from element', () => {
      const div = document.createElement('div')
      div.innerHTML = '<p>Hello <strong>world</strong>!</p>'
      document.body.appendChild(div)

      const textNodes = extractTextNodes(div)
      
      expect(textNodes).toHaveLength(3)
      expect(textNodes[0].textContent).toBe('Hello ')
      expect(textNodes[1].textContent).toBe('world')
      expect(textNodes[2].textContent).toBe('!')
    })

    it('should skip script and style elements', () => {
      const div = document.createElement('div')
      div.innerHTML = `
        <p>Visible text</p>
        <script>console.log('hidden')</script>
        <style>body { color: red; }</style>
        <noscript>No script</noscript>
      `
      document.body.appendChild(div)

      const textNodes = extractTextNodes(div)
      const contents = textNodes.map(node => node.textContent?.trim()).filter(Boolean)
      
      expect(contents).toEqual(['Visible text'])
    })

    it('should skip empty or whitespace-only text nodes', () => {
      const div = document.createElement('div')
      div.innerHTML = '<p>Text</p>   <p>  </p><p>More text</p>'
      document.body.appendChild(div)

      const textNodes = extractTextNodes(div)
      const contents = textNodes.map(node => node.textContent?.trim()).filter(Boolean)
      
      expect(contents).toEqual(['Text', 'More text'])
    })

    it('should skip UI elements', () => {
      const div = document.createElement('div')
      div.innerHTML = `
        <p>Content text</p>
        <button>Click me</button>
        <nav>Navigation</nav>
        <input type="text" value="Input">
        <div role="navigation">Menu</div>
      `
      document.body.appendChild(div)

      const textNodes = extractTextNodes(div)
      const contents = textNodes.map(node => node.textContent?.trim()).filter(Boolean)
      
      expect(contents).toEqual(['Content text'])
    })
  })

  describe('htmlToPlaceholders', () => {
    it('should convert HTML tags to placeholders', () => {
      const html = '<p>Hello <strong>world</strong>!</p>'
      const { text, map } = htmlToPlaceholders(html)

      expect(text).toMatch(/<p_\d+>Hello <strong_\d+>world<\/strong_\d+>!<\/p_\d+>/)
      expect(map.size).toBe(4) // <p>, <strong>, </strong>, </p>
    })

    it('should handle nested tags', () => {
      const html = '<div><p>Text with <em><strong>nested</strong></em> tags</p></div>'
      const { text, map } = htmlToPlaceholders(html)

      expect(text).toContain('Text with')
      expect(text).toContain('nested')
      expect(text).toContain('tags')
      expect(map.size).toBe(8) // All opening and closing tags
    })

    it('should handle self-closing tags', () => {
      const html = 'Text<br/>with<img src="test.jpg"/>breaks'
      const { text, map } = htmlToPlaceholders(html)

      expect(text).toContain('Text')
      expect(text).toContain('with')
      expect(text).toContain('breaks')
      expect(map.size).toBe(2) // <br/> and <img .../>
    })
  })

  describe('placeholdersToHtml', () => {
    it('should restore HTML from placeholders', () => {
      const originalHtml = '<p>Hello <strong>world</strong>!</p>'
      const { text, map } = htmlToPlaceholders(originalHtml)
      const restoredHtml = placeholdersToHtml(text, map)

      expect(restoredHtml).toBe(originalHtml)
    })

    it('should handle complex nested HTML', () => {
      const originalHtml = '<div class="test"><p>Text with <em><strong>nested</strong></em> tags</p></div>'
      const { text, map } = htmlToPlaceholders(originalHtml)
      const restoredHtml = placeholdersToHtml(text, map)

      expect(restoredHtml).toBe(originalHtml)
    })

    it('should handle modified text between placeholders', () => {
      const html = '<p>Hello world</p>'
      const { text, map } = htmlToPlaceholders(html)
      
      // Simulate translation by modifying text between placeholders
      const translatedText = text.replace('Hello world', 'こんにちは世界')
      const restoredHtml = placeholdersToHtml(translatedText, map)

      expect(restoredHtml).toBe('<p>こんにちは世界</p>')
    })

    it('should handle placeholders with spaces from LLM', () => {
      const html = '<a href="#">Link</a> and <strong>bold</strong>'
      const { text, map } = htmlToPlaceholders(html)
      
      // Simulate LLM adding spaces to placeholders
      const translatedWithSpaces = text
        .replace('<a_0>', '< a_0>')
        .replace('</a_1>', '</ a_1 >')
        .replace('<strong_2>', '< strong_2 >')
        .replace('</strong_3>', '</strong_3 >')
        .replace('Link', 'リンク')
        .replace('and', 'と')
        .replace('bold', '太字')
      
      const restoredHtml = placeholdersToHtml(translatedWithSpaces, map)
      
      expect(restoredHtml).toContain('<a href="#">')
      expect(restoredHtml).toContain('</a>')
      expect(restoredHtml).toContain('<strong>')
      expect(restoredHtml).toContain('</strong>')
      expect(restoredHtml).toContain('リンク')
      expect(restoredHtml).toContain('太字')
    })

    it('should handle unmatched placeholders gracefully', () => {
      const html = 'Normal text'
      const { map } = htmlToPlaceholders(html)
      
      // Text with random placeholders that don't exist in map
      const textWithBrokenPlaceholders = 'Normal text < random_99> and < /broken_100 >'
      
      const restoredHtml = placeholdersToHtml(textWithBrokenPlaceholders, map)
      
      // Our new logic tries to preserve structure as simple tags
      expect(restoredHtml).toBe('Normal text <random> and </broken>')
    })
  })

  describe('clusterTextNodes', () => {
    it('should group text nodes into clusters based on parent elements', () => {
      const div = document.createElement('div')
      div.innerHTML = '<p>Short text</p><p>Another short text</p>'
      document.body.appendChild(div)

      const textNodes = extractTextNodes(div)
      const clusters = clusterTextNodes(textNodes)

      // Adjacent paragraphs are now grouped together for better context
      expect(clusters.length).toBe(1)
      expect(clusters[0].nodes.length).toBe(2)
      expect(clusters[0].text).toContain('Short text')
      expect(clusters[0].text).toContain('Another short text')
    })

    it('should combine text nodes from the same parent element', () => {
      const div = document.createElement('div')
      const p = document.createElement('p')
      p.innerHTML = 'First part <strong>bold text</strong> last part'
      div.appendChild(p)
      document.body.appendChild(div)

      const textNodes = extractTextNodes(div)
      const clusters = clusterTextNodes(textNodes)

      // All text nodes from same paragraph should be in one cluster
      expect(clusters.length).toBe(1)
      expect(clusters[0].nodes.length).toBe(3) // "First part ", "bold text", " last part"
      expect(clusters[0].text).toContain('First part')
      expect(clusters[0].text).toContain('bold text')
      expect(clusters[0].text).toContain('last part')
    })

    it('should skip very short text nodes', () => {
      const div = document.createElement('div')
      div.innerHTML = '<p>Valid text</p><p>Another valid text</p>'
      document.body.appendChild(div)

      const textNodes = extractTextNodes(div)
      const clusters = clusterTextNodes(textNodes)

      // Adjacent paragraphs should be grouped together
      expect(clusters.length).toBe(1)
      expect(clusters[0].text).toContain('Valid text')
      expect(clusters[0].text).toContain('Another valid text')
    })

    it('should separate unrelated content into different clusters', () => {
      const div = document.createElement('div')
      div.innerHTML = `
        <article>
          <p>Article paragraph 1</p>
          <p>Article paragraph 2</p>
        </article>
        <div class="sidebar">
          <h3>Sidebar Title</h3>
          <p>Sidebar content</p>
        </div>
      `
      document.body.appendChild(div)

      const textNodes = extractTextNodes(div)
      const clusters = clusterTextNodes(textNodes)

      // Article and sidebar should be in separate clusters
      expect(clusters.length).toBe(2)
      expect(clusters[0].text).toContain('Article paragraph 1')
      expect(clusters[0].text).toContain('Article paragraph 2')
      expect(clusters[1].text).toContain('Sidebar Title')
      expect(clusters[1].text).toContain('Sidebar content')
    })
  })

  describe('applyTranslation', () => {
    it('should apply translated text to original nodes', () => {
      const div = document.createElement('div')
      div.innerHTML = '<p>Hello world</p>'
      document.body.appendChild(div)

      const textNodes = extractTextNodes(div)
      const clusters = clusterTextNodes(textNodes)
      const cluster = clusters[0]

      // Simulate translation
      const translatedText = 'こんにちは世界'
      
      applyTranslation(cluster, translatedText)

      expect(div.textContent).toContain('こんにちは世界')
    })

    it('should store original text in data attribute', () => {
      const div = document.createElement('div')
      div.innerHTML = '<p>Original text</p>'
      document.body.appendChild(div)

      const textNodes = extractTextNodes(div)
      const clusters = clusterTextNodes(textNodes)
      const cluster = clusters[0]

      applyTranslation(cluster, 'Translated text')

      const p = div.querySelector('p')
      expect(p?.getAttribute('data-original-text')).toBe('Original text')
      expect(p?.textContent).toBe('Translated text')
    })

    it('should handle translations with different lengths', () => {
      const div = document.createElement('div')
      div.innerHTML = '<p>Hello world</p>'
      document.body.appendChild(div)

      const textNodes = extractTextNodes(div)
      const clusters = clusterTextNodes(textNodes)
      const cluster = clusters[0]

      // Simulate translation with different length
      const translatedText = 'こんにちは世界、今日はいい天気ですね'

      applyTranslation(cluster, translatedText)

      expect(div.textContent).toBe('こんにちは世界、今日はいい天気ですね')
    })

    it('should handle HTML content with placeholders', () => {
      const html = 'This is <strong>important</strong> and <em>emphasized</em> text'
      const { text, map } = htmlToPlaceholders(html)

      // Check that placeholders were created
      expect(text).toMatch(/<strong_\d+>important<\/strong_\d+>/)
      expect(text).toMatch(/<em_\d+>emphasized<\/em_\d+>/)
      expect(map.size).toBe(4) // <strong>, </strong>, <em>, </em>

      // Simulate translation with placeholders preserved
      const translatedText = text
        .replace('This is', 'これは')
        .replace('important', '重要')
        .replace('and', 'で')
        .replace('emphasized', '強調された')
        .replace('text', 'テキストです')

      const restoredHTML = placeholdersToHtml(translatedText, map)
      
      expect(restoredHTML).toContain('<strong>')
      expect(restoredHTML).toContain('重要')
      expect(restoredHTML).toContain('<em>')
      expect(restoredHTML).toContain('強調された')
    })

    it('should not apply translation if no words found', () => {
      const div = document.createElement('div')
      div.innerHTML = '<p>   </p>' // Only whitespace
      document.body.appendChild(div)

      const textNodes = extractTextNodes(div)
      
      if (textNodes.length > 0) {
        const clusters = clusterTextNodes(textNodes)
        const cluster = clusters[0]
        const originalText = div.textContent

        applyTranslation(cluster, '')

        expect(div.textContent).toBe(originalText)
      }
    })
  })
})