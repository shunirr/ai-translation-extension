// Readability integration for article content extraction (simplified for overlay mode)
import { isProbablyReaderable, Readability } from '@mozilla/readability'

export interface ExtractedArticle {
  content: string  // HTML string content
  title?: string
  excerpt?: string
  byline?: string
  siteName?: string
}

// Check if the document is probably readerable (article-like content)
export function isReaderable(doc: Document): boolean {
  return isProbablyReaderable(doc)
}

// Extract article content for overlay mode
export function extractArticleForOverlay(doc: Document): ExtractedArticle | null {
  try {
    // Clone document to avoid modifying the original DOM
    const documentClone = doc.cloneNode(true) as Document
    
    // Parse with Readability
    const reader = new Readability(documentClone)
    const article = reader.parse()
    
    if (!article || !article.content) {
      console.debug('Readability: No article content found')
      return null
    }
    
    return {
      content: article.content,  // HTML string
      title: article.title || undefined,
      excerpt: article.excerpt || undefined,
      byline: article.byline || undefined,
      siteName: article.siteName || undefined
    }
  } catch (error) {
    console.error('Readability: Error extracting article:', error)
    return null
  }
}