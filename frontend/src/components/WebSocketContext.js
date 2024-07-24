/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { createContext, useState } from 'react';
import WebSocketUse from './WebSocketUse';

export const WebSocketContext = createContext();

export function WebSocketProvider({ children, wssHost }) {
  const { messages, sendMessage, logMessage } = WebSocketUse(wssHost);
  // console.log(`WebSocketProvider: wssHost: ${wssHost} messages ${messages.length}`);

  return (
    <WebSocketContext.Provider value={{ messages, sendMessage, logMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
}