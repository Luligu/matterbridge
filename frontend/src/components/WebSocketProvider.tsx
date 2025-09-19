/* eslint-disable react-hooks/exhaustive-deps */
 
// React
import { useEffect, useRef, useState, useCallback, useMemo, createContext, useContext, ReactNode } from 'react';

// Backend
import { WsBroadcastMessageId, WsMessageBroadcast, WsMessageApiRequest, WsMessageApiResponse, WsMessage, WsMessageErrorApiResponse } from '../../../src/frontendTypes';

// Frontend modules
import { UiContext } from './UiProvider';
import { debug } from '../App';
// const debug = true;

// TypeScript interfaces for context values
export interface WebSocketMessagesContextType {
  messages: string[];
  maxMessages: number;
  autoScroll: boolean;
  setMessages: React.Dispatch<React.SetStateAction<string[]>>;
  setLogFilters: (level: string, search: string) => void;
  setMaxMessages: React.Dispatch<React.SetStateAction<number>>;
  setAutoScroll: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface WebSocketContextType {
  maxMessages: number;
  autoScroll: boolean;
  logFilterLevel: string;
  logFilterSearch: string;
  setMessages: React.Dispatch<React.SetStateAction<string[]>>;
  setLogFilters: (level: string, search: string) => void;
  setMaxMessages: React.Dispatch<React.SetStateAction<number>>;
  setAutoScroll: React.Dispatch<React.SetStateAction<boolean>>;
  online: boolean;
  retry: number;
  getUniqueId: () => number;
  addListener: (listener: (msg: WsMessage) => void) => void;
  removeListener: (listener: (msg: WsMessage) => void) => void;
  sendMessage: (message: WsMessageApiRequest) => void;
  logMessage: (badge: string, message: string) => void;
}

export const WebSocketMessagesContext = createContext<WebSocketMessagesContextType>(null as unknown as WebSocketMessagesContextType);
 
export const WebSocketContext = createContext<WebSocketContextType>(null as unknown as WebSocketContextType);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  // States
  const [logFilterLevel, setLogFilterLevel] = useState(localStorage.getItem('logFilterLevel') ?? 'info');
  const [logFilterSearch, setLogFilterSearch] = useState(localStorage.getItem('logFilterSearch') ?? '*');
  const [messages, setMessages] = useState<string[]>([]);
  const [maxMessages, setMaxMessages] = useState(1000);
  const [autoScroll, setAutoScroll] = useState(true);
  const [online, setOnline] = useState(false);

  // Contexts
  const { showSnackbarMessage, closeSnackbarMessage, closeSnackbar } = useContext(UiContext);

  // Refs
  const listenersRef = useRef<Array<(msg: WsMessageApiResponse | WsMessageBroadcast) => void>>([]);
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
    const badgeSpan = `<span style="background-color: #5c0e91; color: white; padding: 1px 5px; font-size: 12px; border-radius: 3px;">${badge}</span>`;
    setMessages(prevMessages => [...prevMessages, badgeSpan + ' <span style="color: var(--main-log-color);">' + message + '</span>']);
  }, []);

  const setLogFilters = useCallback((level: string, search: string) => {
    setLogFilterLevel(level);
    setLogFilterSearch(search);
    logMessage('WebSocket', `Filtering by log level "${level}" and log search "${search}"`);
  }, [logMessage]);

  const addListener = useCallback((listener: (msg: WsMessageApiResponse | WsMessageBroadcast) => void) => {
    if (debug) console.log(`WebSocket addListener:`, listener);
    listenersRef.current = [...listenersRef.current, listener];
    if (debug) console.log(`WebSocket addListener total listeners:`, listenersRef.current.length);
  }, []);

  const removeListener = useCallback((listener: (msg: WsMessageApiResponse | WsMessageBroadcast) => void) => {
    if (debug) console.log(`WebSocket removeListener:`, listener);
    listenersRef.current = listenersRef.current.filter(l => l !== listener);
    if (debug) console.log(`WebSocket removeListener total listeners:`, listenersRef.current.length);
  }, []);

  const connectWebSocket = useCallback(() => {
    if (wssHost === '' || wssHost === null || wssHost === undefined) return;
    /*
    Direct http: WebSocketUse: window.location.host=localhost:8283 window.location.href=http://localhost:8283/ wssHost=ws://localhost:8283
    Direct https: WebSocketUse: window.location.host=localhost:8443 window.location.href=https://localhost:8443/ wssHost=wss://localhost:8443
    Ingress: WebSocketUse window.location.host: homeassistant.local:8123 window.location.href: http://homeassistant.local:8123/api/hassio_ingress/nD0C1__RqgwrZT_UdHObtcPNN7fCFxCjlmPQfCzVKI8/ Connecting to WebSocket: ws://homeassistant.local:8123/api/hassio_ingress/nD0C1__RqgwrZT_UdHObtcPNN7fCFxCjlmPQfCzVKI8/
    console.log(`WebSocketUse: window.location.host=${window.location.host} window.location.protocol=${window.location.protocol} window.location.href=${window.location.href} wssHost=${wssHost}`);
    */
    logMessage('WebSocket', `Connecting to WebSocket: ${wssHost}`);
    wsRef.current = new WebSocket(wssHost);

    wsRef.current.onmessage = (event) => {
      if (!online) setOnline(true);
      try {
        const msg: WsMessageBroadcast = JSON.parse(event.data);
        if (msg.id === undefined) return; // Ignore messages without an ID
        if ((msg as WsMessageErrorApiResponse).error) {
          if (debug) console.error(`WebSocket error message:`, msg);
        }
        if (msg.id === uniqueIdRef.current && msg.src === 'Matterbridge' && msg.dst === 'Frontend' && (msg as unknown as WsMessageApiResponse).response === 'pong') {
          if (debug) console.log(`WebSocket pong response message:`, msg, 'listeners:', listenersRef.current.length);
          if (offlineTimeoutRef.current) clearTimeout(offlineTimeoutRef.current);
          listenersRef.current.forEach(listener => listener(msg)); // Notify all listeners
          return;
        }
        if (msg.id === WsBroadcastMessageId.RefreshRequired) {
          if (debug) console.log(`WebSocket WS_ID_REFRESH_REQUIRED message:`, msg, 'listeners:', listenersRef.current.length);
          listenersRef.current.forEach(listener => listener(msg)); // Notify all listeners
          return;
        } else if (msg.id === WsBroadcastMessageId.RestartRequired) {
          if (debug) console.log(`WebSocket WS_ID_RESTART_REQUIRED message:`, msg, 'listeners:', listenersRef.current.length);
          listenersRef.current.forEach(listener => listener(msg)); // Notify all listeners
          return;
        } else if (msg.id === WsBroadcastMessageId.RestartNotRequired) {
          if (debug) console.log(`WebSocket WS_ID_RESTART_NOT_REQUIRED message:`, msg, 'listeners:', listenersRef.current.length);
          listenersRef.current.forEach(listener => listener(msg)); // Notify all listeners
          return;
        } else if (msg.id === WsBroadcastMessageId.CpuUpdate) {
          if (debug) console.log(`WebSocket WS_ID_CPU_UPDATE message:`, msg, 'listeners:', listenersRef.current.length);
          listenersRef.current.forEach(listener => listener(msg)); // Notify all listeners
          return;
        } else if (msg.id === WsBroadcastMessageId.MemoryUpdate) {
          if (debug) console.log(`WebSocket WS_ID_MEMORY_UPDATE message:`, msg, 'listeners:', listenersRef.current.length);
          listenersRef.current.forEach(listener => listener(msg)); // Notify all listeners
          return;
        } else if (msg.id === WsBroadcastMessageId.UptimeUpdate) {
          if (debug) console.log(`WebSocket WS_ID_UPTIME_UPDATE message:`, msg, 'listeners:', listenersRef.current.length);
          listenersRef.current.forEach(listener => listener(msg)); // Notify all listeners
          return;
        } else if (msg.id === WsBroadcastMessageId.Snackbar && msg.params && msg.params.message) {
          if (debug) console.log(`WebSocket WS_ID_SNACKBAR message:`, msg, 'listeners:', listenersRef.current.length);
          showSnackbarMessage(msg.params.message, msg.params.timeout, msg.params.severity);
          return;
        } else if (msg.id === WsBroadcastMessageId.CloseSnackbar && msg.params && msg.params.message) {
          if (debug) console.log(`WebSocket WS_ID_CLOSE_SNACKBAR message:`, msg, 'listeners:', listenersRef.current.length);
          closeSnackbarMessage(msg.params.message);
          return;
        } else if (msg.id === WsBroadcastMessageId.ShellySysUpdate) {
          if (debug) console.log(`WebSocket WS_ID_SHELLY_SYS_UPDATE message:`, msg, 'listeners:', listenersRef.current.length);
          listenersRef.current.forEach(listener => listener(msg)); // Notify all listeners
          return;
        } else if (msg.id === WsBroadcastMessageId.ShellyMainUpdate) {
          if (debug) console.log(`WebSocket WS_ID_SHELLY_MAIN_UPDATE message:`, msg, 'listeners:', listenersRef.current.length);
          listenersRef.current.forEach(listener => listener(msg)); // Notify all listeners
          return;
        } else if (msg.id !== WsBroadcastMessageId.Log) {
          if (debug) console.log(`WebSocket message:`, msg, 'listeners:', listenersRef.current.length);
          listenersRef.current.forEach(listener => listener(msg)); // Notify all listeners
          return;
        }

        // Process log messages
        if (!msg.params || !msg.params.level || !msg.params.time || !msg.params.name || !msg.params.message) return;

        // Process log filtering by level
        const normalLevels = ['debug', 'info', 'notice', 'warn', 'error', 'fatal'];
        if (normalLevels.includes(msg.params.level)) {
          if (logFilterLevelRef.current === 'info' && msg.params.level === 'debug') return;
          if (logFilterLevelRef.current === 'notice' && (msg.params.level === 'debug' || msg.params.level === 'info')) return;
          if (logFilterLevelRef.current === 'warn' && (msg.params.level === 'debug' || msg.params.level === 'info' || msg.params.level === 'notice')) return;
          if (logFilterLevelRef.current === 'error' && (msg.params.level === 'debug' || msg.params.level === 'info' || msg.params.level === 'notice' || msg.params.level === 'warn')) return;
          if (logFilterLevelRef.current === 'fatal' && (msg.params.level === 'debug' || msg.params.level === 'info' || msg.params.level === 'notice' || msg.params.level === 'warn' || msg.params.level === 'error')) return;
        }

        // Process log filtering by search
        if (logFilterSearchRef.current !== '*' && logFilterSearchRef.current !== '' && !msg.params.message.toLowerCase().includes(logFilterSearchRef.current.toLowerCase()) && !msg.params.name.toLowerCase().includes(logFilterSearchRef.current.toLowerCase())) return;

        // Ignore uncommissioned messages
        if(msg.params.name === 'Commissioning' && msg.params.message.includes('is uncommissioned')) return;

        setMessages(prevMessages => {
          // Create new array with new message
          const timeString = `<span style="color: #505050;">[${msg.params?.time}]</span>`;
          const getsubTypeMessageBgColor = (level?: string) => {
            switch (level?.toLowerCase()) {
              case 'debug':
                return 'gray';
              case 'info':
                return '#267fb7';
              case 'notice':
                return 'green';
              case 'warn':
                return '#e9db18';
              case 'error':
                return 'red';
              case 'fatal':
                return '#ff0000';
              case 'spawn':
                return '#ff00d0';
              default:
                return 'lightblue';
            }
          };
          const getsubTypeMessageColor = (level?: string) => {
            switch (level?.toLowerCase()) {
              case 'warn':
                return 'black';
              default:
                return 'white';
            }
          };
          const coloredSubType = `<span style="background-color: ${getsubTypeMessageBgColor(msg.params?.level)}; color: ${getsubTypeMessageColor(msg.params?.level)}; padding: 1px 5px; font-size: 12px; border-radius: 3px;">${msg.params?.level}</span>`;
          const newMessage = `${coloredSubType} ${timeString} <span style="color: #09516d;">[${msg.params?.name}]</span> <span style="color: var(--main-log-color);">${msg.params?.message}</span>`;
          const newMessages = [...prevMessages, newMessage];
          // Check if the new array length exceeds the maximum allowed
          if (newMessages.length > maxMessages) {
            // Remove 10% of the oldest messages to maintain maxMessages count
            return newMessages.slice(maxMessages / 10);
          }
          return newMessages;
        });
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