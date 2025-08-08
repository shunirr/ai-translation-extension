import { describe, it, expect, vi, beforeEach } from 'vitest'

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

describe('Background Script', () => {
  let installedListener: any
  let contextMenuClickListener: any
  let messageListener: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Capture listeners
    vi.mocked(chrome.runtime.onInstalled.addListener).mockImplementation((listener) => {
      installedListener = listener
    })
    vi.mocked(chrome.contextMenus.onClicked.addListener).mockImplementation((listener) => {
      contextMenuClickListener = listener
    })
    vi.mocked(chrome.runtime.onMessage.addListener).mockImplementation((listener) => {
      messageListener = listener
    })
  })

  describe('Installation', () => {
    it('should create context menu on install', async () => {
      await import('../src/background')

      // Trigger installation
      installedListener()

      expect(chrome.contextMenus.create).toHaveBeenCalledWith({
        id: 'translate-page',
        title: 'Translate this page',
        contexts: ['page'],
      })
    })
  })

  describe('Context menu', () => {
    it('should handle context menu click', async () => {
      await import('../src/background')

      const tab = { id: 123 }
      const info = { menuItemId: 'translate-page' }

      contextMenuClickListener(info, tab)

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(123, { action: 'translate' })
    })

    it('should ignore clicks on other menu items', async () => {
      await import('../src/background')

      const tab = { id: 123 }
      const info = { menuItemId: 'other-item' }

      contextMenuClickListener(info, tab)

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled()
    })

    it('should handle missing tab id', async () => {
      await import('../src/background')

      const info = { menuItemId: 'translate-page' }

      contextMenuClickListener(info, null)

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled()
    })
  })

  describe('Message handling', () => {
    it('should forward translate messages to content script', async () => {
      await import('../src/background')

      const sendResponse = vi.fn()
      const sender = { tab: { id: 456 } }

      const result = messageListener(
        { action: 'translate' },
        sender,
        sendResponse
      )

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(456, { action: 'translate' })
      expect(result).toBe(true)
    })

    it('should update badge on translation status', async () => {
      await import('../src/background')

      const sendResponse = vi.fn()
      const sender = { tab: { id: 456 } }

      // Translation in progress
      messageListener(
        { action: 'updateBadge', status: 'translating' },
        sender,
        sendResponse
      )

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({
        text: '...',
        tabId: 456
      })
      expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
        color: '#1a73e8',
        tabId: 456
      })
    })

    it('should handle error badge update', async () => {
      await import('../src/background')

      const sendResponse = vi.fn()
      const sender = { tab: { id: 456 } }

      messageListener(
        { action: 'updateBadge', status: 'error' },
        sender,
        sendResponse
      )

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({
        text: '!',
        tabId: 456
      })
      expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
        color: '#d33c26',
        tabId: 456
      })
    })

    it('should clear badge on completion', async () => {
      await import('../src/background')

      const sendResponse = vi.fn()
      const sender = { tab: { id: 456 } }

      messageListener(
        { action: 'updateBadge', status: 'completed' },
        sender,
        sendResponse
      )

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({
        text: '',
        tabId: 456
      })
    })
  })
})