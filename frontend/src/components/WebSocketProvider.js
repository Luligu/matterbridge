import React, { createContext } from 'react';
import WebSocketUse from './WebSocketUse';

export const WebSocketContext = createContext();

export function WebSocketProvider({ children }) {
  const { messages, sendMessage, logMessage, setLogFilters } = WebSocketUse();
  // console.log(`WebSocketProvider: wssHost: ${wssHost} messages ${messages.length}`);

  return (
    <WebSocketContext.Provider value={{ messages, sendMessage, logMessage, setLogFilters }}>
      {children}
    </WebSocketContext.Provider>
  );
}