// API wrapper for LLMs compatible with OpenAI GPT protocol

import { RateLimiter } from './rate-limiter'

export interface TranslationRequest {
  text: string
  targetLanguage: string
  apiEndpoint: string
  apiKey: string
  model: string
}

export interface ApiConfig {
  rps?: number
}

export interface TranslationResponse {
  translatedText: string
  error?: string
}

let rateLimiter: RateLimiter | null = null

export function configureApi(config: ApiConfig): void {
  if (!rateLimiter || config.rps !== undefined) {
    rateLimiter = new RateLimiter(config.rps || 0.5)
  }
}

export function updateRateLimit(rps: number): void {
  if (!rateLimiter) {
    rateLimiter = new RateLimiter(rps)
  } else {
    rateLimiter.updateRPS(rps)
  }
}

export async function translateText(request: TranslationRequest): Promise<TranslationResponse> {
  const { text, targetLanguage, apiEndpoint, apiKey, model } = request
  
  const languageNames = {
    ja: 'Japanese',
    en: 'English',
    ko: 'Korean'
  }
  
  const targetLanguageName = languageNames[targetLanguage as keyof typeof languageNames] || targetLanguage
  
  // Check if this is a batch request
  const isBatch = text.includes('\n---DELIMITER---\n')
  
  const systemPrompt = isBatch 
    ? `You are a professional translator. Translate each text segment to ${targetLanguageName}. 
The input contains multiple text segments separated by "---DELIMITER---".
You must:
1. Translate each segment independently
2. Preserve the exact delimiter "---DELIMITER---" between translations
3. Preserve all HTML placeholders in the format <tag_n> exactly as they appear
4. Return only the translations with delimiters, no explanations`
    : `You are a professional translator. Translate the given text to ${targetLanguageName}. 
Preserve all HTML placeholders in the format <tag_n> exactly as they appear in the input.
Only return the translated text without any explanation.`
  
  try {
    if (!rateLimiter) {
      rateLimiter = new RateLimiter(0.5)
    }
    
    const response = await rateLimiter.execute(() => fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })
    }))
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    const translatedText = data.choices[0].message.content
    
    return { translatedText }
  } catch (error) {
    return {
      translatedText: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}