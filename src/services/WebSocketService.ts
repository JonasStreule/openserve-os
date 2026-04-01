import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface WSClient {
  ws: WebSocket;
  channel: string; // 'kitchen', 'service', 'guest'
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: WSClient[] = [];

  init(server: Server) {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws, req) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const channel = url.searchParams.get('channel') || 'service';

      const client: WSClient = { ws, channel };
      this.clients.push(client);

      console.log(`WebSocket client connected: ${channel} (${this.clients.length} total)`);

      ws.on('close', () => {
        this.clients = this.clients.filter(c => c.ws !== ws);
        console.log(`WebSocket client disconnected (${this.clients.length} total)`);
      });

      ws.on('error', (err) => {
        console.error('WebSocket error:', err);
      });
    });
  }

  broadcast(channel: string, event: string, data: any) {
    const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });

    this.clients
      .filter(c => c.channel === channel && c.ws.readyState === WebSocket.OPEN)
      .forEach(c => c.ws.send(message));
  }

  broadcastAll(event: string, data: any) {
    const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });

    this.clients
      .filter(c => c.ws.readyState === WebSocket.OPEN)
      .forEach(c => c.ws.send(message));
  }

  // Convenience methods
  notifyOrderCreated(order: any) {
    this.broadcast('kitchen', 'order:created', order);
    this.broadcast('service', 'order:created', order);
  }

  notifyOrderUpdated(order: any) {
    this.broadcast('kitchen', 'order:updated', order);
    this.broadcast('service', 'order:updated', order);
    this.broadcast('guest', 'order:updated', order);
  }

  notifyPaymentCompleted(payment: any) {
    this.broadcast('service', 'payment:completed', payment);
  }
}

export const wsService = new WebSocketService();
