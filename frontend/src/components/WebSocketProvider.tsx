/* eslint-disable react-hooks/exhaustive-deps */
 
// React
import { useEffect, useRef, useState, useCallback, useMemo, createContext, useContext, ReactNode } from 'react';

// Backend
import { WsMessageApiRequest, WsMessageApiResponse, WsMessageErrorApiResponse } from '../../../src/frontendTypes';

// Frontend modules
import { UiContext } from './UiProvider';
import { debug } from '../App';
// const debug = true;

// TypeScript interface for log messages
export interface WsLogMessage {
  level: string;
  time: string;
  name: string;
  message: string;
}

// TypeScript interfaces for context values
export interface WebSocketMessagesContextType {
  messages: WsLogMessage[];
  maxMessages: number;
  autoScroll: boolean;
  setMessages: React.Dispatch<React.SetStateAction<WsLogMessage[]>>;
  setLogFilters: (level: string, search: string) => void;
  setMaxMessages: React.Dispatch<React.SetStateAction<number>>;
  setAutoScroll: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface WebSocketContextType {
  maxMessages: number;
  autoScroll: boolean;
  logFilterLevel: string;
  logFilterSearch: string;
  setMessages: React.Dispatch<React.SetStateAction<WsLogMessage[]>>;
  setLogFilters: (level: string, search: string) => void;
  setMaxMessages: React.Dispatch<React.SetStateAction<number>>;
  setAutoScroll: React.Dispatch<React.SetStateAction<boolean>>;
  online: boolean;
  retry: number;
  getUniqueId: () => number;
  addListener: (listener: (msg: WsMessageApiResponse) => void, id: number) => void;
  removeListener: (listener: (msg: WsMessageApiResponse) => void) => void;
  sendMessage: (message: WsMessageApiRequest) => void;
  logMessage: (badge: string, message: string) => void;
}

export const WebSocketMessagesContext = createContext<WebSocketMessagesContextType>(null as unknown as WebSocketMessagesContextType);
 
export const WebSocketContext = createContext<WebSocketContextType>(null as unknown as WebSocketContextType);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  // States
  const [logFilterLevel, setLogFilterLevel] = useState(localStorage.getItem('logFilterLevel') ?? 'info');
  const [logFilterSearch, setLogFilterSearch] = useState(localStorage.getItem('logFilterSearch') ?? '*');
  const [messages, setMessages] = useState<WsLogMessage[]>([]);
  const [maxMessages, setMaxMessages] = useState(1000);
  const [autoScroll, setAutoScroll] = useState(true);
  const [online, setOnline] = useState(false);

  // Contexts
  const { showSnackbarMessage, closeSnackbarMessage, closeSnackbar } = useContext(UiContext);

  // Refs
  const listenersRef = useRef<{ listener: (msg: WsMessageApiResponse) => void; id: number }[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(1);
  const uniqueIdRef = useRef(Math.floor(Math.random() * (999999 - 1000 + 1)) + 1000);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const offlineTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const logFilterLevelRef = useRef(logFilterLevel);
  const logFilterSearchRef = useRef(logFilterSearch);

  // Memos
  const wssHost = useMemo(() => window.location.href.replace(/^http/, 'ws'), []); // Replace "http" or "https" with "ws" or "wss"
  const isIngress = useMemo(() => window.location.href.includes('api/hassio_ingress'), []);

  // Constants
  // const maxMessages = 1000;
  const maxRetries = 100;

  const pingIntervalSeconds = 60;
  const offlineTimeoutSeconds = 50;
  const startTimeoutSeconds = 300;

  useEffect(() => {
    logFilterLevelRef.current = logFilterLevel;
  }, [logFilterLevel]);

  useEffect(() => {
    logFilterSearchRef.current = logFilterSearch;
  }, [logFilterSearch]);

  const getUniqueId = useCallback(() => {
    return Math.floor(Math.random() * (999999 - 1000 + 1)) + 1000;
  }, []);

  const sendMessage = useCallback((message: WsMessageApiRequest) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        if (debug) console.log(`WebSocket sending message with id ${message.id}:`, message);
        if (message.id === undefined) message.id = uniqueIdRef.current;
        const msg = JSON.stringify(message);
        wsRef.current.send(msg);
        if (debug) console.log(`WebSocket sent message:`, message);
      } catch (error) {
        if (debug) console.error(`WebSocket error sending message: ${error}`);
      }
    } else {
      if (debug) console.error(`WebSocket message not sent, WebSocket not connected:`, message);
    }
  }, []);

  const logMessage = useCallback((badge: string, message: string) => {
    setMessages(prevMessages => [...prevMessages, { level: badge, time: '', name: '', message }]);
  }, []);

  const setLogFilters = useCallback((level: string, search: string) => {
    setLogFilterLevel(level);
    setLogFilterSearch(search);
    logMessage('WebSocket', `Filtering by log level "${level}" and log search "${search}"`);
  }, [logMessage]);

  const addListener = useCallback((listener: (msg: WsMessageApiResponse) => void, id: number) => {
    if (debug) console.log(`WebSocket addListener id ${id}:`, listener);
    if(id === undefined || id === null || isNaN(id) || id === 0) console.error(`WebSocket addListener called without id, listener not added:`, listener);
    // listenersRef.current = [...listenersRef.current, listener];
    listenersRef.current = [...listenersRef.current, { listener, id }];
    if (debug) console.log(`WebSocket addListener total listeners:`, listenersRef.current.length);
  }, []);

  const removeListener = useCallback((listener: (msg: WsMessageApiResponse) => void) => {
    if (debug) console.log(`WebSocket removeListener:`, listener);
    // listenersRef.current = listenersRef.current.filter(l => l !== listener);
    listenersRef.current = listenersRef.current.filter(l =>  l.listener !== listener);
    if (debug) console.log(`WebSocket removeListener total listeners:`, listenersRef.current.length);
  }, []);

  const connectWebSocket = useCallback(() => {
    if (wssHost === '' || wssHost === null || wssHost === undefined) return;
    logMessage('WebSocket', `Connecting to WebSocket: ${wssHost}`);
    wsRef.current = new WebSocket(wssHost);

    wsRef.current.onmessage = (event) => {
      if (!online) setOnline(true);
      try {
        const msg: WsMessageApiResponse = JSON.parse(event.data);
        if (msg.id === undefined || msg.src === undefined || msg.dst === undefined) {
          console.error(`WebSocket undefined message id/src/dst:`, msg);
          return;
        }
        if (msg.src !== 'Matterbridge' || msg.dst !== 'Frontend') {
          console.error(`WebSocket invalid message src/dst:`, msg);
          return;
        }
        if ((msg as unknown as WsMessageErrorApiResponse).error) {
          console.error(`WebSocket error message response:`, msg);
          return;
        }
        if (msg.id === uniqueIdRef.current && msg.method === 'pong' && msg.response === 'pong') {
          if (debug) console.log(`WebSocket pong response message id ${msg.id}:`, msg);
          if (offlineTimeoutRef.current) clearTimeout(offlineTimeoutRef.current);
          offlineTimeoutRef.current = null;
          return;
        } else if (msg.method === 'snackbar' && msg.response && msg.response.message) {
          if (debug) console.log(`WebSocket message id ${msg.id} method ${msg.method}:`, msg);
          showSnackbarMessage(msg.response.message, msg.response.timeout, msg.response.severity);
          return;
        } else if (msg.method === 'close_snackbar' && msg.response && msg.response.message) {
          if (debug) console.log(`WebSocket message id ${msg.id} method ${msg.method}:`, msg);
          closeSnackbarMessage(msg.response.message);
          return;
        } else if (msg.method === 'log') {
          // if (debug) console.log(`WebSocket message id ${msg.id} method ${msg.method}:`, msg);
          // Process only valid log messages
          if (!msg.response || !msg.response.level || !msg.response.time || !msg.response.name || !msg.response.message) return;
          // Process log filtering by level
          const normalLevels = ['debug', 'info', 'notice', 'warn', 'error', 'fatal'];
          if (normalLevels.includes(msg.response.level)) {
            if (logFilterLevelRef.current === 'info' && msg.response.level === 'debug') return;
            if (logFilterLevelRef.current === 'notice' && (msg.response.level === 'debug' || msg.response.level === 'info')) return;
            if (logFilterLevelRef.current === 'warn' && (msg.response.level === 'debug' || msg.response.level === 'info' || msg.response.level === 'notice')) return;
            if (logFilterLevelRef.current === 'error' && (msg.response.level === 'debug' || msg.response.level === 'info' || msg.response.level === 'notice' || msg.response.level === 'warn')) return;
            if (logFilterLevelRef.current === 'fatal' && (msg.response.level === 'debug' || msg.response.level === 'info' || msg.response.level === 'notice' || msg.response.level === 'warn' || msg.response.level === 'error')) return;
          }

          // Process log filtering by search
          if (logFilterSearchRef.current !== '*' && logFilterSearchRef.current !== '' && !msg.response.message.toLowerCase().includes(logFilterSearchRef.current.toLowerCase()) && !msg.response.name.toLowerCase().includes(logFilterSearchRef.current.toLowerCase())) return;

          // Ignore uncommissioned messages
          if(msg.response.name === 'Commissioning' && msg.response.message.includes('is uncommissioned')) return;

          setMessages(prevMessagesNew => {
            const newMessagesNew = [...prevMessagesNew, { level: msg.response.level, time: msg.response.time, name: msg.response.name, message: msg.response.message }];
            // Check if the new array length exceeds the maximum allowed
            if (newMessagesNew.length > maxMessages) {
              // Remove 10% of the oldest messages to maintain maxMessages count
              return newMessagesNew.slice(maxMessages / 10);
            }
            return newMessagesNew;
          });
        } else {
          if (debug) console.log(`WebSocket received message id ${msg.id} method ${msg.method}:`, msg);
          if(msg.id === 0) {
            listenersRef.current.forEach(listener => listener.listener(msg)); // Notify all listeners for broadcast messages
          } else {
            const listener = listenersRef.current.find(l => l.id === msg.id);
            if (listener) listener.listener(msg); // Notify the specific listener
            else {
              if (debug) console.debug(`WebSocket no listener found for message id ${msg.id}:`, msg);
              // listenersRef.current.forEach(listener => console.error(`WebSocket existing listener id ${listener.id}:`, listener.listener));
              // listenersRef.current.forEach(listener => listener.listener(msg)); // Notify all listeners
            }
          }
          return;
        }

      } catch (error) {
        console.error(`WebSocketUse error parsing message: ${error}`);
      }
    };

    wsRef.current.onopen = () => {
      if (debug) console.log(`WebSocket: Connected to WebSocket: ${wssHost}`);
      logMessage('WebSocket', `Connected to WebSocket: ${wssHost}`);
      setOnline(true);
      closeSnackbar();
      retryCountRef.current = 1;

      startTimeoutRef.current = setTimeout(() => {

        pingIntervalRef.current = setInterval(() => {
          sendMessage({ id: uniqueIdRef.current, method: "ping", src: "Frontend", dst: "Matterbridge", params: {} });
          if (offlineTimeoutRef.current) clearTimeout(offlineTimeoutRef.current);
          offlineTimeoutRef.current = setTimeout(() => {
            if (debug) console.error(`WebSocketUse: No pong response received from WebSocket: ${wssHost}`);
            logMessage('WebSocket', `No pong response received from WebSocket: ${wssHost}`);
            setOnline(false);
          }, 1000 * offlineTimeoutSeconds);
        }, 1000 * pingIntervalSeconds);

      }, 1000 * startTimeoutSeconds);

    };

    wsRef.current.onclose = () => {
      if (debug) console.error(`WebSocket: Disconnected from WebSocket ${isIngress?'with Ingress':''}: ${wssHost}`);
      logMessage('WebSocket', `Disconnected from WebSocket: ${wssHost}`);
      setOnline(false);
      closeSnackbar();
      if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
      if (offlineTimeoutRef.current) clearTimeout(offlineTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      logMessage('WebSocket', `Reconnecting (attempt ${retryCountRef.current} of ${maxRetries}) to WebSocket${isIngress ? ' (Ingress)' : ''}: ${wssHost}`);
      if(isIngress) {
        setTimeout(attemptReconnect, 5000);
      } else {
        if (retryCountRef.current === 1) attemptReconnect();
        else if (retryCountRef.current < maxRetries) setTimeout(attemptReconnect, 1000 * retryCountRef.current);
        else logMessage('WebSocket', `Reconnect attempts exceeded limit of ${maxRetries} retries, refresh the page to reconnect to: ${wssHost}`);
      }
      retryCountRef.current = retryCountRef.current + 1;
    };

    wsRef.current.onerror = (error) => {
      if (debug) console.error(`WebSocket: WebSocket error connecting to ${wssHost}:`, error);
      logMessage('WebSocket', `WebSocket error connecting to ${wssHost}`);
    };
  }, [wssHost]);

  const attemptReconnect = useCallback(() => {
    if (debug) console.log(`WebSocket attemptReconnect ${retryCountRef.current}/${maxRetries} to:`, wssHost);
    connectWebSocket();
  }, [connectWebSocket]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  const contextMessagesValue = useMemo(() => ({
    messages,
    maxMessages,
    autoScroll,
    setMessages,
    setLogFilters,
    setMaxMessages,
    setAutoScroll,
  }), [messages, setMessages, setLogFilters]);

  const contextValue = useMemo(() => ({
    maxMessages,
    autoScroll,
    logFilterLevel,
    logFilterSearch,
    setMessages,
    setLogFilters,
    setMaxMessages,
    setAutoScroll,
    online,
    retry: retryCountRef.current,
    getUniqueId,
    addListener,
    removeListener,
    sendMessage,
    logMessage,
  }), [maxMessages, autoScroll, setMessages, setLogFilters, setMaxMessages, setAutoScroll, online, retryCountRef.current, addListener, removeListener, sendMessage, logMessage]);

  return (
    <WebSocketMessagesContext.Provider value={contextMessagesValue}>
      <WebSocketContext.Provider value={contextValue}>
        {children}
      </WebSocketContext.Provider>
    </WebSocketMessagesContext.Provider>
  );
}