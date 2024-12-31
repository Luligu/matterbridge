// React
import React, { createContext, useState, useEffect } from 'react';

export const OnlineContext = createContext();

export function OnlineProvider({ children }) {
  const [online, setOnline] = useState(false);
  const [matterbridgeInfo, setMatterbridgeInfo] = useState({});

  // Fetch settings from the backend
  const fetchSettings = () => {
    fetch('./api/settings')
      .then(response => response.json())
      .then(data => { 
        setOnline(true);
        setMatterbridgeInfo(data.matterbridgeInformation);
      })
      .catch(error => {
        console.error('From OnlineProvider error fetching settings:', error);
        setOnline(false);
      });
  };
  
  useEffect(() => {
    fetchSettings();
    const fetchInterval = setInterval(fetchSettings, 10 * 1000);
    return () => clearInterval(fetchInterval);
  }, []);

  return (
    <OnlineContext.Provider value={{ online, setOnline, matterbridgeInfo }}>
      {children}
    </OnlineContext.Provider>
  );
}