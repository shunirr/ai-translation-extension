import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RateLimiter } from '../src/rate-limiter'

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should limit requests to specified RPS', async () => {
    const rateLimiter = new RateLimiter(2) // 2 requests per second
    const mockFn = vi.fn().mockResolvedValue('result')
    
    // Queue 4 requests
    const promises = [
      rateLimiter.execute(mockFn),
      rateLimiter.execute(mockFn),
      rateLimiter.execute(mockFn),
      rateLimiter.execute(mockFn)
    ]
    
    // First 2 should execute immediately
    await vi.advanceTimersByTimeAsync(50)
    expect(mockFn).toHaveBeenCalledTimes(2)
    
    // Next 2 should execute after 500ms each (1000ms / 2 RPS = 500ms interval)
    await vi.advanceTimersByTimeAsync(500)
    expect(mockFn).toHaveBeenCalledTimes(3)
    
    await vi.advanceTimersByTimeAsync(500)
    expect(mockFn).toHaveBeenCalledTimes(4)
    
    const results = await Promise.all(promises)
    expect(results).toEqual(['result', 'result', 'result', 'result'])
  })

  it('should handle errors properly', async () => {
    const rateLimiter = new RateLimiter(1)
    const mockFn = vi.fn().mockRejectedValue(new Error('Test error'))
    
    await expect(rateLimiter.execute(mockFn)).rejects.toThrow('Test error')
  })

  it('should update RPS dynamically', async () => {
    const rateLimiter = new RateLimiter(1) // Start with 1 RPS
    const mockFn = vi.fn().mockResolvedValue('result')
    
    // Queue 2 requests
    const promise1 = rateLimiter.execute(mockFn)
    const promise2 = rateLimiter.execute(mockFn)
    
    // First should execute immediately
    await vi.advanceTimersByTimeAsync(50)
    expect(mockFn).toHaveBeenCalledTimes(1)
    
    // Update to 10 RPS (100ms interval)
    rateLimiter.updateRPS(10)
    
    // Second should execute much faster now
    await vi.advanceTimersByTimeAsync(100)
    expect(mockFn).toHaveBeenCalledTimes(2)
    
    await Promise.all([promise1, promise2])
  })

  it('should clear queue when requested', async () => {
    const rateLimiter = new RateLimiter(1)
    const mockFn = vi.fn().mockResolvedValue('result')
    
    // Queue multiple requests
    rateLimiter.execute(mockFn)
    rateLimiter.execute(mockFn)
    rateLimiter.execute(mockFn)
    
    // First executes immediately
    await vi.advanceTimersByTimeAsync(50)
    expect(mockFn).toHaveBeenCalledTimes(1)
    
    // Clear the queue
    rateLimiter.clearQueue()
    
    // No more executions should happen
    await vi.advanceTimersByTimeAsync(2000)
    expect(mockFn).toHaveBeenCalledTimes(1)
  })
})