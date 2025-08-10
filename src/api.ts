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
    rateLimiter = new RateLimiter(config.rps || 0.9)
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
CRITICAL RULES:
1. Translate each segment independently
2. Preserve the EXACT delimiter "---DELIMITER---" between translations
3. NEVER remove or modify HTML placeholders like <a_0>, </a_0>, <span_1>, </span_1> etc.
4. ALL placeholders must appear in the EXACT same format in your translation
5. Placeholders mark HTML structure and MUST be preserved exactly as-is
6. Return only the translations with delimiters, no explanations

Example:
Input: <a_0>Hello <span_1>world</span_1></a_0>
Output: <a_0>こんにちは<span_1>世界</span_1></a_0>`
    : `You are a professional translator. Translate the given text to ${targetLanguageName}. 
CRITICAL: You MUST preserve ALL HTML placeholders EXACTLY as they appear.
Placeholders look like <tag_n> and </tag_n> where tag is a name and n is a number.
These placeholders MUST appear in your translation in the EXACT same format.
Never remove, modify, or skip any placeholder.

Example:
Input: <a_0>Click <span_1>here</span_1></a_0> to continue
Output: <a_0><span_1>ここ</span_1>をクリック</a_0>して続行

Only return the translated text.`
  
  try {
    if (!rateLimiter) {
      rateLimiter = new RateLimiter(0.9)
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
        max_tokens: 4000,
        // Add GPT-5 specific parameters for Chat Completions API
        ...(model.toLowerCase().includes('gpt-5') 
          ? { 
              reasoning_effort: 'minimal', // Use minimal reasoning for fast translation
              verbosity: 'low' // Low verbosity for concise translations
            }
          : {})
      })
    }))
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      const errorMessage = errorData?.error?.message || `${response.status} ${response.statusText}`
      throw new Error(`API request failed: ${errorMessage}`)
    }
    
    const data = await response.json()
    const translatedText = data.choices[0]?.message?.content || ''
    
    return { translatedText }
  } catch (error) {
    return {
      translatedText: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}