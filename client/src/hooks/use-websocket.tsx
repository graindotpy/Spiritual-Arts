import { useEffect, useRef, useState } from 'react';

export interface SpiritDieRollBroadcast {
  character: {
    id: string;
    name: string;
    path: string;
    level: number;
    portraitUrl: string | null;
  };
  roll: {
    spInvestment: number;
    dieSize: string;
    dieIndex: number;
    value: number;
    success: boolean;
    techniqueId?: string | null;
    techniqueName?: string | null;
    timestamp: string;
  };
}

export interface WebSocketMessage {
  type: 'spirit_die_roll';
  data: SpiritDieRollBroadcast;
}

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastRollBroadcast, setLastRollBroadcast] = useState<SpiritDieRollBroadcast | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const connect = () => {
      try {
        ws.current = new WebSocket(wsUrl);
        
        ws.current.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);
        };
        
        ws.current.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            if (message.type === 'spirit_die_roll') {
              setLastRollBroadcast(message.data);
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };
        
        ws.current.onclose = () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);
          // Reconnect after 3 seconds
          setTimeout(connect, 3000);
        };
        
        ws.current.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
        };
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  return {
    isConnected,
    lastRollBroadcast
  };
}
