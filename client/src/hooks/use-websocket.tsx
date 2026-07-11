import { useEffect, useRef, useState } from "react";
import {
  spiritDieRollMessageSchema,
  type SpiritDieRollBroadcast,
} from "@shared/realtime";

export type { SpiritDieRollBroadcast } from "@shared/realtime";

export function useWebSocket() {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);
  const [lastRollBroadcast, setLastRollBroadcast] =
    useState<SpiritDieRollBroadcast | null>(null);

  useEffect(() => {
    let disposed = false;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws`;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const scheduleReconnect = (connect: () => void) => {
      if (disposed || reconnectTimerRef.current) return;
      const baseDelay = Math.min(30_000, 1_000 * 2 ** attemptsRef.current);
      const delay = baseDelay + Math.round(Math.random() * 500);
      attemptsRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (disposed) return;

      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        if (disposed) {
          socket.close();
          return;
        }
        attemptsRef.current = 0;
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        if (disposed) return;
        try {
          const message: unknown = JSON.parse(String(event.data));
          const parsed = spiritDieRollMessageSchema.safeParse(message);
          if (parsed.success) {
            setLastRollBroadcast(parsed.data.data);
          }
        } catch {
          // Ignore malformed messages. The connection remains usable.
        }
      };

      socket.onerror = () => {
        if (disposed) return;
        setIsConnected(false);
      };

      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }
        setIsConnected(false);
        scheduleReconnect(connect);
      };
    };

    connect();

    return () => {
      disposed = true;
      clearReconnectTimer();
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
      }
    };
  }, []);

  return { isConnected, lastRollBroadcast };
}
