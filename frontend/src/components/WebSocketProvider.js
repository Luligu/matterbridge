import React, { createContext } from 'react';
import WebSocketUse from './WebSocketUse';

export const WebSocketContext = createContext();

export function WebSocketProvider({ children }) {
  const { messages, sendMessage, logMessage, setLogFilters, ws } = WebSocketUse();
  // console.log(`WebSocketProvider: wssHost: ${wssHost} messages ${messages.length}`);

  return (
    <WebSocketContext.Provider value={{ messages, sendMessage, logMessage, setLogFilters, ws }}>
      {children}
    </WebSocketContext.Provider>
  );
}