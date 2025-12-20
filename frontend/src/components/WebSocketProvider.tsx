/* eslint-disable react-hooks/exhaustive-deps */
// React
import { useEffect, useRef, useState, useCallback, useMemo, createContext, useContext, ReactNode } from 'react';

// Backend
import { WsMessageApiRequest, WsMessageApiResponse, WsMessageErrorApiResponse } from '../../../src/frontendTypes';

// Frontend modules
import { UiContext } from './UiProvider';
import { MbfLsk } from '../utils/localStorage';
import { debug, isIngress, wssPassword } from '../App';
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
  logLength: React.RefObject<number>;
  logFilterLevel: string;
  logFilterSearch: string;
  logAutoScroll: React.RefObject<boolean>;
  setMessages: React.Dispatch<React.SetStateAction<WsLogMessage[]>>;
  setLogFilterLevel: React.Dispatch<React.SetStateAction<string>>;
  setLogFilterSearch: React.Dispatch<React.SetStateAction<string>>;
  filterLogMessages: (level: string, search: string) => void;
}

export interface WebSocketContextType {
  logLength: React.RefObject<number>;
  logFilterLevel: string;
  logFilterSearch: string;
  logAutoScroll: React.RefObject<boolean>;
  setMessages: React.Dispatch<React.SetStateAction<WsLogMessage[]>>;
  setLogFilterLevel: React.Dispatch<React.SetStateAction<string>>;
  setLogFilterSearch: React.Dispatch<React.SetStateAction<string>>;
  filterLogMessages: (level: string, search: string) => void;
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
  const [messages, setMessages] = useState<WsLogMessage[]>([]);
  const [logFilterLevel, setLogFilterLevel] = useState(localStorage.getItem(MbfLsk.logFilterLevel) ?? 'info');
  const [logFilterSearch, setLogFilterSearch] = useState(localStorage.getItem(MbfLsk.logFilterSearch) ?? '*');

  const [online, setOnline] = useState(false);

  // Contexts
  const { showSnackbarMessage, closeSnackbarMessage, closeSnackbar, showInstallProgress, hideInstallProgress, exitInstallProgressSuccess, exitInstallProgressError, addInstallProgress } = useContext(UiContext);

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
  const messagesCounterRef = useRef(0);
  const messagesCounterIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const logLength = useRef(Number(localStorage.getItem(MbfLsk.logLength) ?? 200));
  const logAutoScroll = useRef(localStorage.getItem(MbfLsk.logAutoScroll) === 'false' ? false : true);

  // Memos
  const wssHost = useMemo(() => window.location.href.replace(/^http/, 'ws'), []); // Replace "http" or "https" with "ws" or "wss" and memoize

  // Constants
  const maxRetries = 100;
  const pingIntervalSeconds = 60;
  const offlineTimeoutSeconds = 50;
  const startTimeoutSeconds = 300;
  const messagesCounterSeconds = 10;

  useEffect(() => {
    if (debug) console.log(`WebSocket messages started counter interval`);
    messagesCounterIntervalRef.current = setInterval(() => {
      if (messagesCounterRef.current > 0) {
        if (debug) console.log(`WebSocket messages received in the last ${messagesCounterSeconds} seconds: ${messagesCounterRef.current * (60 / messagesCounterSeconds)} messages/minute`);
        messagesCounterRef.current = 0;
      }
    }, messagesCounterSeconds * 1000);

    return () => {
      if (debug) console.log(`WebSocket messages stopped counter interval`);
      if (messagesCounterIntervalRef.current) clearInterval(messagesCounterIntervalRef.current);
      messagesCounterIntervalRef.current = null;
    };
  }, []);

  useEffect(() => {
    logFilterLevelRef.current = logFilterLevel;
  }, [logFilterLevel]);

  useEffect(() => {
    logFilterSearchRef.current = logFilterSearch;
  }, [logFilterSearch]);

  const getUniqueId = useCallback(() => {
    return Math.floor(Math.random() * (999999 - 1000 + 1)) + 1000;
  }, []);

  const filterLogMessages = useCallback((level: string, search: string) => {
    if (debug) console.log(`WebSocket filterLogMessages called with level "${level}" and search "${search}"...`);
    setMessages((prevMessages) => {
      return prevMessages.filter((msg) => {
        // Process log filtering by level. Leave 'spawn' and other system levels always visible
        if (['debug', 'info', 'notice', 'warn', 'error', 'fatal'].includes(msg.level)) {
          if (level === 'info' && msg.level === 'debug') return false;
          if (level === 'notice' && (msg.level === 'debug' || msg.level === 'info')) return false;
          if (level === 'warn' && (msg.level === 'debug' || msg.level === 'info' || msg.level === 'notice')) return false;
          if (level === 'error' && (msg.level === 'debug' || msg.level === 'info' || msg.level === 'notice' || msg.level === 'warn')) return false;
          if (level === 'fatal' && (msg.level === 'debug' || msg.level === 'info' || msg.level === 'notice' || msg.level === 'warn' || msg.level === 'error')) return false;
        }
        // Process log filtering by normal search
        if (search !== '*' && search !== '' && !search.startsWith('/') && !search.endsWith('/') && !msg.message.toLowerCase().includes(search.toLowerCase()) && !msg.name.toLowerCase().includes(search.toLowerCase())) return false;

        // Process log filtering by regex search
        if (
          search.startsWith('/') &&
          search.endsWith('/') &&
          (() => {
            try {
              const regex = new RegExp(search.slice(1, -1), 'i');
              return !regex.test(msg.message) && !regex.test(msg.name);
            } catch (error) {
              /*if (debug)*/ console.error(`WebSocket log search invalid regex filter "${search}":`, error);
              return false;
            }
          })()
        )
          return false;

        return true;
      });
    });
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
    setMessages((prevMessages) => [...prevMessages, { level: badge, time: '', name: '', message }]);
  }, []);

  const addListener = useCallback((listener: (msg: WsMessageApiResponse) => void, id: number) => {
    if (debug) console.log(`WebSocket addListener id ${id}:`, listener);
    if (id === undefined || id === null || isNaN(id) || id === 0) console.error(`WebSocket addListener called without id, listener not added:`, listener);
    // listenersRef.current = [...listenersRef.current, listener];
    listenersRef.current = [...listenersRef.current, { listener, id }];
    if (debug) console.log(`WebSocket addListener total listeners:`, listenersRef.current.length);
  }, []);

  const removeListener = useCallback((listener: (msg: WsMessageApiResponse) => void) => {
    if (debug) console.log(`WebSocket removeListener:`, listener);
    listenersRef.current = listenersRef.current.filter((l) => l.listener !== listener);
    if (debug) console.log(`WebSocket removeListener total listeners:`, listenersRef.current.length);
  }, []);

  const connectWebSocket = useCallback(() => {
    if (wssHost === '' || wssHost === null || wssHost === undefined) return;
    logMessage('WebSocket', `Connecting ${wssPassword ? `with password` : ''} to WebSocket: ${wssHost}`);
    if (debug) console.log(`WebSocket connecting to: ${wssHost}${wssPassword ? `?password=[redacted]` : ''}`);
    wsRef.current = new WebSocket(wssHost + (wssPassword ? `?password=${encodeURIComponent(wssPassword)}` : ''));

    wsRef.current.onmessage = (event) => {
      if (!online) setOnline(true);
      messagesCounterRef.current += 1;
      try {
        const msg: WsMessageApiResponse = JSON.parse(event.data);
        if (msg.id === undefined || msg.src === undefined || msg.dst === undefined) {
          if (debug) console.error(`WebSocket undefined message id/src/dst:`, msg);
          return;
        }
        if (msg.src !== 'Matterbridge' || msg.dst !== 'Frontend') {
          if (debug) console.error(`WebSocket invalid message src/dst:`, msg);
          return;
        }
        if ((msg as unknown as WsMessageErrorApiResponse).error) {
          if (debug) console.error(`WebSocket error message response:`, msg);
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
          // Process only valid log messages
          if (!msg.response || !msg.response.level || !msg.response.time || !msg.response.name || !msg.response.message) return;

          // Send to InstallProgressDialog if it's an install log
          if (msg.response.level === 'spawn') {
            if (msg.response.name === 'Matterbridge:spawn-init') showInstallProgress(msg.response.message, '', '');
            else if (msg.response.name === 'Matterbridge:spawn-exit-success') exitInstallProgressSuccess();
            else if (msg.response.name === 'Matterbridge:spawn-exit-error') exitInstallProgressError();
            else addInstallProgress(msg.response.message + '\n');
          }

          // Process log filtering by level
          const normalLevels = ['debug', 'info', 'notice', 'warn', 'error', 'fatal'];
          if (normalLevels.includes(msg.response.level)) {
            if (logFilterLevelRef.current === 'info' && msg.response.level === 'debug') return;
            if (logFilterLevelRef.current === 'notice' && (msg.response.level === 'debug' || msg.response.level === 'info')) return;
            if (logFilterLevelRef.current === 'warn' && (msg.response.level === 'debug' || msg.response.level === 'info' || msg.response.level === 'notice')) return;
            if (logFilterLevelRef.current === 'error' && (msg.response.level === 'debug' || msg.response.level === 'info' || msg.response.level === 'notice' || msg.response.level === 'warn')) return;
            if (logFilterLevelRef.current === 'fatal' && (msg.response.level === 'debug' || msg.response.level === 'info' || msg.response.level === 'notice' || msg.response.level === 'warn' || msg.response.level === 'error')) return;
          }

          // Process log filtering by normal search
          if (
            logFilterSearchRef.current !== '*' &&
            logFilterSearchRef.current !== '' &&
            !logFilterSearchRef.current.startsWith('/') &&
            !logFilterSearchRef.current.endsWith('/') &&
            !msg.response.message.toLowerCase().includes(logFilterSearchRef.current.toLowerCase()) &&
            !msg.response.name.toLowerCase().includes(logFilterSearchRef.current.toLowerCase())
          )
            return;

          // Process log filtering by regex search
          if (
            logFilterSearchRef.current.startsWith('/') &&
            logFilterSearchRef.current.endsWith('/') &&
            (() => {
              try {
                const regex = new RegExp(logFilterSearchRef.current.slice(1, -1), 'i');
                return !regex.test(msg.response.message) && !regex.test(msg.response.name);
              } catch (error) {
                /*if (debug)*/ console.error(`WebSocket log search invalid regex filter "${logFilterSearchRef.current}":`, error);
                return false;
              }
            })()
          )
            return;

          // Ignore uncommissioned messages to avoid the QR code spam
          if (msg.response.name === 'Commissioning' && msg.response.message.includes('is uncommissioned')) return;

          setMessages((prevMessages) => {
            const newMessages = [...prevMessages, { level: msg.response.level, time: msg.response.time, name: msg.response.name, message: msg.response.message }];
            if (debug) console.log(`WebSocket new log message added (${newMessages.length}/${logLength.current}):`, newMessages[newMessages.length - 1]);
            // Check if the new array length exceeds the maximum allowed length plus 10%
            if (newMessages.length > logLength.current + (logLength.current * 10) / 100) {
              if (debug) console.log(`WebSocket sliced log messages to the last ${logLength.current} entries`);
              return newMessages.slice(newMessages.length - logLength.current); // Keep only the last 'logLength' messages
            }
            return newMessages;
          });
        } else {
          if (debug) console.log(`WebSocket received message id ${msg.id} method ${msg.method}:`, msg);
          if (msg.id === 0) {
            listenersRef.current.forEach((listener) => listener.listener(msg)); // Notify all listeners for broadcast messages
          } else {
            const listener = listenersRef.current.find((l) => l.id === msg.id);
            if (listener)
              listener.listener(msg); // Notify the specific listener
            else {
              /*if (debug)*/ console.warn(`WebSocket no listener found for message id ${msg.id}:`, msg);
            }
          }
          return;
        }
      } catch (error) {
        console.error(`WebSocket error parsing message: ${error}`, error instanceof Error ? error.stack : null);
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
          sendMessage({ id: uniqueIdRef.current, method: 'ping', src: 'Frontend', dst: 'Matterbridge', params: {} });
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
      if (debug) console.error(`WebSocket: Disconnected from WebSocket ${isIngress ? 'with Ingress' : ''}: ${wssHost}`);
      logMessage('WebSocket', `Disconnected from WebSocket: ${wssHost}`);
      setOnline(false);
      closeSnackbar();
      hideInstallProgress();
      if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
      if (offlineTimeoutRef.current) clearTimeout(offlineTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      logMessage('WebSocket', `Reconnecting (attempt ${retryCountRef.current} of ${maxRetries}) to WebSocket${isIngress ? ' (Ingress)' : ''}: ${wssHost}`);
      if (isIngress) {
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
  }, [wssHost]); // Intentionally left out dependencies to avoid reconnect loops

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

  const contextMessagesValue = useMemo(
    () => ({
      messages,
      logLength,
      logAutoScroll,
      logFilterLevel,
      logFilterSearch,
      setMessages,
      setLogFilterLevel,
      setLogFilterSearch,
      filterLogMessages,
    }),
    [messages, logLength, logAutoScroll, logFilterLevel, logFilterSearch, setMessages, setLogFilterLevel, setLogFilterSearch, filterLogMessages],
  );

  const contextValue = useMemo(
    () => ({
      logLength,
      logAutoScroll,
      logFilterLevel,
      logFilterSearch,
      setMessages,
      setLogFilterLevel,
      setLogFilterSearch,
      filterLogMessages,
      online,
      retry: retryCountRef.current,
      getUniqueId,
      addListener,
      removeListener,
      sendMessage,
      logMessage,
    }),
    [logLength, logAutoScroll, setMessages, setLogFilterLevel, setLogFilterSearch, online, retryCountRef.current, addListener, removeListener, sendMessage, logMessage],
  );

  return (
    <WebSocketMessagesContext.Provider value={contextMessagesValue}>
      <WebSocketContext.Provider value={contextValue}>{children}</WebSocketContext.Provider>
    </WebSocketMessagesContext.Provider>
  );
}
