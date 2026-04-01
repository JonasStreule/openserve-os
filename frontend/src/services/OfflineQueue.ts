interface QueuedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

export class OfflineQueue {
  private queue: QueuedRequest[] = [];

  constructor() {
    this.loadQueue();
    window.addEventListener('online', () => this.flushQueue());
  }

  async enqueue(request: QueuedRequest) {
    this.queue.push(request);
    this.saveQueue();
  }

  private saveQueue() {
    localStorage.setItem('offlineQueue', JSON.stringify(this.queue));
  }

  private loadQueue() {
    const saved = localStorage.getItem('offlineQueue');
    this.queue = saved ? JSON.parse(saved) : [];
  }

  async flushQueue() {
    const pending = [...this.queue];
    for (const request of pending) {
      try {
        await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        });
        this.queue = this.queue.filter(r => r !== request);
        this.saveQueue();
      } catch (error) {
        console.error('Failed to sync:', error);
        break;
      }
    }
  }
}
