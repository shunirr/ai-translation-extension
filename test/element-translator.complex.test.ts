import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTranslatableElements } from '../src/element-translator'

// Mock chrome API
global.chrome = {
  runtime: {
    sendMessage: vi.fn(),
  },
} as any

describe('Element Translator - Complex Elements', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  describe('getTranslatableElements with complex HTML', () => {
    it('should include large paragraph elements with complex nested structure', () => {
      // Create a complex paragraph similar to Wikipedia content
      document.body.innerHTML = `
        <p>Simple paragraph before</p>
        <p>在仁牙因湾登陆的部队是由<span class="ilh-all" data-orig-title="沃爾特·克魯格" data-lang-code="en" data-lang-name="英语" data-foreign-title="Walter Krueger"><span class="ilh-page"><a href="/wiki/test" class="new" title="Test">沃尔特·克鲁格</a></span><span class="noprint ilh-comment"><span class="ilh-paren">（</span><span class="ilh-lang">英语</span><span class="ilh-colon">：</span><span class="ilh-link"><a href="https://en.wikipedia.org/wiki/Walter_Krueger" class="extiw" title="en:Walter Krueger"><span lang="en" dir="auto">Walter Krueger</span></a></span><span class="ilh-paren">）</span></span></span>陆军中将指挥的美国第6军团，数天内第6军团大约175,000名士兵在沿20公里的海滩登陆。</p>
        <p>Simple paragraph after</p>
      `

      const elements = getTranslatableElements()
      
      // Should include all 3 paragraphs
      expect(elements.length).toBe(3)
      
      // Check that the complex paragraph is included
      const complexParagraph = elements.find(el => 
        el.textContent?.includes('在仁牙因湾登陆的部队')
      )
      expect(complexParagraph).toBeDefined()
      expect(complexParagraph?.tagName).toBe('P')
    })

    it('should handle Wikipedia-style paragraphs with many nested links', () => {
      // Full Wikipedia-style paragraph from the issue
      document.body.innerHTML = `
        <p>在仁牙因湾登陆的部队是由<span class="ilh-all" data-orig-title="沃爾特·克魯格" data-lang-code="en" data-lang-name="英语" data-foreign-title="Walter Krueger"><span class="ilh-page"><a href="/w/index.php?title=%E6%B2%83%E7%88%BE%E7%89%B9%C2%B7%E5%85%8B%E9%AD%AF%E6%A0%BC&amp;action=edit&amp;redlink=1" class="new" title="沃尔特·克鲁格（页面不存在）">沃尔特·克鲁格</a></span><span class="noprint ilh-comment"><span class="ilh-paren">（</span><span class="ilh-lang">英语</span><span class="ilh-colon">：</span><span class="ilh-link"><a href="https://en.wikipedia.org/wiki/Walter_Krueger" class="extiw" title="en:Walter Krueger"><span lang="en" dir="auto">Walter Krueger</span></a></span><span class="ilh-paren">）</span></span></span><a href="/w/index.php?title=%E9%99%B8%E8%BB%8D%E4%B8%AD%E5%B0%87&amp;action=edit&amp;redlink=1" class="new" title="陆军中将（页面不存在）">陆军中将</a>指挥的<span class="ilh-all" data-orig-title="美國第6軍團" data-lang-code="en" data-lang-name="英语" data-foreign-title="Sixth United States Army"><span class="ilh-page"><a href="/w/index.php?title=%E7%BE%8E%E5%9C%8B%E7%AC%AC6%E8%BB%8D%E5%9C%98&amp;action=edit&amp;redlink=1" class="new" title="美国第6军团（页面不存在）">美国第6军团</a></span><span class="noprint ilh-comment"><span class="ilh-paren">（</span><span class="ilh-lang">英语</span><span class="ilh-colon">：</span><span class="ilh-link"><a href="https://en.wikipedia.org/wiki/Sixth_United_States_Army" class="extiw" title="en:Sixth United States Army"><span lang="en" dir="auto">Sixth United States Army</span></a></span><span class="ilh-paren">）</span></span></span>，数天内第6军团大约175,000名士兵在沿20公里的海滩登陆，<a href="/w/index.php?title=%E7%BE%8E%E5%9C%8B%E7%AC%AC1%E8%BB%8D&amp;action=edit&amp;redlink=1" class="new" title="美国第1军（页面不存在）">美国第1军</a>负责掩护其侧翼，而由<a href="/w/index.php?title=%E5%A5%A7%E6%96%AF%E5%8D%A1%C2%B7%E6%A0%BC%E5%88%A9%E6%96%AF%E6%B2%83%E5%BE%B7&amp;action=edit&amp;redlink=1" class="new" title="奥斯卡·格利斯沃德（页面不存在）">奥斯卡·格利斯沃德</a>率领的<a href="/w/index.php?title=%E7%BE%8E%E5%9C%8B%E7%AC%AC14%E8%BB%8D&amp;action=edit&amp;redlink=1" class="new" title="美国第14军（页面不存在）">美国第14军</a>则向南进攻马尼拉，虽然克鲁格十分担心日军攻击他毫无掩护的东翼，但日军没有这样做，而美军直到1月23日到达<a href="/wiki/%E8%BF%AA%E5%A5%A7%E6%96%AF%E9%81%94%E5%A4%9A%C2%B7%E9%A6%AC%E5%8D%A1%E5%B8%95%E5%8A%A0%E7%88%BE%E5%9C%8B%E9%9A%9B%E6%A9%9F%E5%A0%B4" class="mw-redirect" title="迪奥斯达多·马卡帕加尔国际机场">克拉克空军基地</a>前没有遇到强大的抵抗，攻取基地的战役直至1月底，攻占该基地后，第14军继续向马尼拉推进<sup id="cite_ref-brochure_1-2" class="reference"><a href="#cite_note-brochure-1"><span class="cite-bracket">[</span>1<span class="cite-bracket">]</span></a></sup>。</p>
      `

      const elements = getTranslatableElements()
      
      // Should include the complex paragraph
      expect(elements.length).toBe(1)
      expect(elements[0].tagName).toBe('P')
      
      // Verify it contains the expected content
      expect(elements[0].textContent).toContain('在仁牙因湾登陆的部队')
      expect(elements[0].textContent).toContain('克拉克空军基地')
    })

    it('should handle paragraphs up to 8000 bytes', () => {
      // Create a large paragraph that's between 3000-8000 bytes
      const longText = 'This is a test paragraph with many words. '.repeat(70)
      const complexHTML = `
        <p>${longText}<span class="complex"><a href="#">Link 1</a></span> and <span class="complex"><a href="#">Link 2</a></span> and more content here.</p>
      `
      document.body.innerHTML = complexHTML

      const elements = getTranslatableElements()
      
      // Should include the large paragraph
      expect(elements.length).toBe(1)
      expect(elements[0].tagName).toBe('P')
      
      // Check size is within new limits
      const htmlSize = new TextEncoder().encode(elements[0].innerHTML).length
      expect(htmlSize).toBeLessThanOrEqual(8000)
      expect(htmlSize).toBeGreaterThan(2000)
    })

    it('should still exclude extremely large paragraphs over 8000 bytes', () => {
      // Create a paragraph that exceeds 8000 bytes
      const veryLongText = 'This is a test paragraph with many words. '.repeat(200)
      const hugeHTML = `
        <p>${veryLongText}<span class="complex"><a href="#">Link</a></span>${veryLongText}</p>
      `
      document.body.innerHTML = hugeHTML

      const elements = getTranslatableElements()
      
      // Should exclude paragraphs over 8000 bytes
      expect(elements.length).toBe(0)
    })

    it('should handle mixed content with various sizes', () => {
      document.body.innerHTML = `
        <p>Short paragraph</p>
        <p>${'Medium paragraph with some content. '.repeat(50)}</p>
        <p>${'Large paragraph with complex structure. '.repeat(100)}<span class="nested"><a href="#">Link</a></span></p>
        <p>${'Extremely large paragraph that exceeds limits. '.repeat(300)}</p>
        <div>Simple div content</div>
      `

      const elements = getTranslatableElements()
      
      // Should include first 3 paragraphs but not the extremely large one
      const paragraphs = elements.filter(el => el.tagName === 'P')
      expect(paragraphs.length).toBe(3)
      
      // Verify sizes
      paragraphs.forEach(p => {
        const size = new TextEncoder().encode(p.innerHTML).length
        expect(size).toBeLessThanOrEqual(8000)
      })
    })
  })
})