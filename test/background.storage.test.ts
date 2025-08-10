import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock configureApi before importing background
vi.mock('../src/api', () => ({
  configureApi: vi.fn(),
}))

// Mock chrome API
global.chrome = {
  runtime: {
    onInstalled: {
      addListener: vi.fn(),
    },
    onMessage: {
      addListener: vi.fn(),
    },
  },
  contextMenus: {
    create: vi.fn(),
    update: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
    },
  },
  tabs: {
    sendMessage: vi.fn(),
  },
  action: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
    setIcon: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
    onChanged: {
      addListener: vi.fn(),
    },
  },
} as any

describe('Background Script - Storage Changes', () => {
  let storageChangeListener: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    
    // Setup listener mocks
    vi.mocked(chrome.storage.onChanged.addListener).mockImplementation((listener) => {
      storageChangeListener = listener
    })
  })

  it('should update context menu when target language changes', async () => {
    // Mock initial storage
    vi.mocked(chrome.storage.local.get).mockResolvedValue({ 
      targetLanguage: 'ja',
      apiRps: 0.5 
    })
    
    await import('../src/background')
    
    // Simulate language change to Korean
    vi.mocked(chrome.storage.local.get).mockResolvedValue({ 
      targetLanguage: 'ko'
    })
    
    const changes = {
      targetLanguage: {
        oldValue: 'ja',
        newValue: 'ko'
      }
    }
    
    storageChangeListener(changes, 'local')
    
    // Wait for async update
    await new Promise(resolve => setTimeout(resolve, 0))
    
    expect(chrome.contextMenus.update).toHaveBeenCalledWith('translate-page', {
      title: 'AI Translation: Korean'
    })
  })

  it('should update API config when RPS changes', async () => {
    const { configureApi } = await import('../src/api')
    
    await import('../src/background')
    
    const changes = {
      apiRps: {
        oldValue: 0.5,
        newValue: 1.0
      }
    }
    
    storageChangeListener(changes, 'local')
    
    expect(configureApi).toHaveBeenCalledWith({ rps: 1.0 })
  })

  it('should handle both language and RPS changes', async () => {
    const { configureApi } = await import('../src/api')
    
    vi.mocked(chrome.storage.local.get).mockResolvedValue({ 
      targetLanguage: 'en'
    })
    
    await import('../src/background')
    
    const changes = {
      targetLanguage: {
        oldValue: 'ja',
        newValue: 'en'
      },
      apiRps: {
        oldValue: 0.5,
        newValue: 0.9
      }
    }
    
    storageChangeListener(changes, 'local')
    
    // Wait for async update
    await new Promise(resolve => setTimeout(resolve, 0))
    
    expect(chrome.contextMenus.update).toHaveBeenCalledWith('translate-page', {
      title: 'AI Translation: English'
    })
    expect(configureApi).toHaveBeenCalledWith({ rps: 0.9 })
  })

  it('should ignore storage changes from sync area', async () => {
    await import('../src/background')
    
    const changes = {
      targetLanguage: {
        oldValue: 'ja',
        newValue: 'en'
      }
    }
    
    storageChangeListener(changes, 'sync')
    
    expect(chrome.contextMenus.update).not.toHaveBeenCalled()
  })
})