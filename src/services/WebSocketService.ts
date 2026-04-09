import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface WSClient {
  ws: WebSocket;
  channel: string; // 'kitchen', 'service', 'guest'
  isAlive: boolean;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: WSClient[] = [];
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  init(server: Server) {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws, req) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const channel = url.searchParams.get('channel') || 'service';

      const client: WSClient = { ws, channel, isAlive: true };
      this.clients.push(client);

      console.log(`WebSocket client connected: ${channel} (${this.clients.length} total)`);

      // Respond to pong frames (heartbeat response)
      ws.on('pong', () => {
        client.isAlive = true;
      });

      ws.on('close', () => {
        this.clients = this.clients.filter(c => c.ws !== ws);
        console.log(`WebSocket client disconnected (${this.clients.length} total)`);
      });

      ws.on('error', (err) => {
        console.error('WebSocket error:', err);
      });
    });

    // Heartbeat: ping all clients every 30s, kill unresponsive ones
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach(client => {
        if (!client.isAlive) {
          console.log('Terminating unresponsive WebSocket client');
          client.ws.terminate();
          return;
        }
        client.isAlive = false;
        client.ws.ping();
      });
      // Clean up terminated clients
      this.clients = this.clients.filter(c => c.ws.readyState !== WebSocket.CLOSED);
    }, 30000);
  }

  /** Gracefully close all connections and stop heartbeat */
  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.clients.forEach(c => {
      try { c.ws.close(1001, 'Server shutting down'); } catch {}
    });
    this.clients = [];
    if (this.wss) {
      this.wss.close();
      console.log('WebSocket server closed');
    }
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
    this.broadcast('bar', 'order:created', order);
    this.broadcast('grill', 'order:created', order);
    this.broadcast('service', 'order:created', order);
  }

  notifyOrderUpdated(order: any) {
    this.broadcast('kitchen', 'order:updated', order);
    this.broadcast('bar', 'order:updated', order);
    this.broadcast('grill', 'order:updated', order);
    this.broadcast('service', 'order:updated', order);
    this.broadcast('guest', 'order:updated', order);
  }

  notifyPaymentCompleted(payment: any) {
    this.broadcast('service', 'payment:completed', payment);
  }
}

export const wsService = new WebSocketService();
