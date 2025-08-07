// API wrapper for LLMs compatible with OpenAI GPT protocol

export interface TranslationRequest {
  text: string
  targetLanguage: string
  apiEndpoint: string
  apiKey: string
  model: string
}

export interface TranslationResponse {
  translatedText: string
  error?: string
}

export async function translateText(request: TranslationRequest): Promise<TranslationResponse> {
  const { text, targetLanguage, apiEndpoint, apiKey, model } = request
  
  const languageNames = {
    ja: 'Japanese',
    en: 'English',
    ko: 'Korean'
  }
  
  const targetLanguageName = languageNames[targetLanguage as keyof typeof languageNames] || targetLanguage
  
  const systemPrompt = `You are a professional translator. Translate the given text to ${targetLanguageName}. 
Preserve all HTML placeholders in the format <tag_n> exactly as they appear in the input.
Only return the translated text without any explanation.`
  
  try {
    const response = await fetch(apiEndpoint, {
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
    })
    
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