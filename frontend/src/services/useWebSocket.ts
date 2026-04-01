import { useEffect, useRef, useState, useCallback } from 'react';

interface WSMessage {
  event: string;
  data: any;
  timestamp: string;
}

export function useWebSocket(channel: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:3000`;
    const ws = new WebSocket(`${wsUrl}?channel=${channel}`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 2 seconds
      setTimeout(connect, 2000);
    };
    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        setLastMessage(msg);
      } catch (e) {
        console.error('Failed to parse WS message:', e);
      }
    };
    ws.onerror = () => ws.close();

    wsRef.current = ws;
  }, [channel]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return { lastMessage, connected };
}
