/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { createContext, useState } from 'react';
import WebSocketUse from './WebSocketUse';

export const WebSocketContext = createContext();

export function WebSocketProvider({ children, wssHost }) {
  const [debugLevel, setDebugLevel] = useState(localStorage.getItem('logFilterLevel')??'debug');
  const [searchCriteria, setSearchCriteria] = useState(localStorage.getItem('logFilterSearch')??'*');
  const { messages, sendMessage } = WebSocketUse(wssHost, debugLevel, searchCriteria);
  // console.log(`WebSocketProvider: wssHost: ${wssHost} debugLevel: ${debugLevel} searchCriteria: ${searchCriteria} messages ${messages.length}`);

  return (
    <WebSocketContext.Provider value={{ messages, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
}