import { useEffect, useRef, useState, useCallback } from 'react';

interface WSMessage {
  event: string;
  data: any;
  timestamp: string;
}

export function useWebSocket(channel: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryDelayRef = useRef(1000);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [connected, setConnected] = useState(false);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = import.meta.env.VITE_WS_URL || `${protocol}//${window.location.host}`;
    const ws = new WebSocket(`${wsUrl}?channel=${channel}`);

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      setConnected(true);
      retryDelayRef.current = 1000;

      clearHeartbeat();
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          // Server pings every 30s — if no data for 45s, connection is likely dead
        }
      }, 45000);
    };
    ws.onclose = () => {
      setConnected(false);
      clearHeartbeat();
      if (!mountedRef.current) return; // don't reconnect after unmount
      const delay = retryDelayRef.current;
      retryDelayRef.current = Math.min(delay * 2, 30000);
      retryTimerRef.current = setTimeout(connect, delay);
    };
    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        setLastMessage(msg);
      } catch {
        // Non-JSON messages (pings) safely ignored
      }
    };
    ws.onerror = () => ws.close();

    wsRef.current = ws;
  }, [channel, clearHeartbeat]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearHeartbeat();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect, clearHeartbeat]);

  return { lastMessage, connected };
}
