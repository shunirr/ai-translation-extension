export class RateLimiter {
  private queue: Array<() => void> = [];
  private lastProcessTime = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private rps: number;

  constructor(rps: number = 1) {
    this.rps = rps;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  updateRPS(rps: number): void {
    this.rps = rps;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.processQueue();
  }

  private processQueue(): void {
    if (this.queue.length === 0) {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      return;
    }

    if (!this.intervalId) {
      const intervalMs = 1000 / this.rps;
      
      // Process first item immediately if enough time has passed
      const now = Date.now();
      if (this.lastProcessTime === 0 || now - this.lastProcessTime >= intervalMs) {
        const task = this.queue.shift();
        if (task) {
          this.lastProcessTime = now;
          task();
        }
      }
      
      this.intervalId = setInterval(() => {
        const now = Date.now();
        if (now - this.lastProcessTime >= intervalMs) {
          const task = this.queue.shift();
          if (task) {
            this.lastProcessTime = now;
            task();
          }
        }

        if (this.queue.length === 0 && this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = null;
        }
      }, 10);
    }
  }

  clearQueue(): void {
    this.queue = [];
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}