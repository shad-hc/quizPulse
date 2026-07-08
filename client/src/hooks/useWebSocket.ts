import { useEffect, useRef, useCallback, useState } from 'react';

const WS_BASE = 'ws://localhost:4000';

export type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseWebSocketOptions {
  quizId: string;
  token: string;
  onMessage: (msg: Record<string, unknown>) => void;
  enabled?: boolean;
}

export function useWebSocket({ quizId, token, onMessage, enabled = true }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WSStatus>('disconnected');
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (!enabled || !quizId || !token) return;
    const url = `${WS_BASE}/ws?token=${encodeURIComponent(token)}&quizId=${quizId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => {
      setStatus('connected');
      console.log('[WS] connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        onMessageRef.current(msg);
      } catch {
        console.error('[WS] bad JSON:', event.data);
      }
    };

    ws.onclose = (e) => {
      setStatus('disconnected');
      console.log('[WS] closed', e.code, e.reason);
      // Auto-reconnect (unless intentional close)
      if (e.code !== 1000 && e.code < 4000) {
        setTimeout(connect, 2000);
      }
    };

    ws.onerror = () => setStatus('error');
  }, [quizId, token, enabled]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close(1000, 'component unmount');
    };
  }, [connect]);

  const send = useCallback((payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    } else {
      console.warn('[WS] not connected, cannot send:', payload.type);
    }
  }, []);

  return { send, status };
}
