/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
 
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
        // console.log('From OnlineProvider /api/settings:', data); 
        setOnline(true);
        setMatterbridgeInfo(data.matterbridgeInformation);
        localStorage.setItem('matterbridgeInformation', data.matterbridgeInformation); 
      })
      .catch(error => {
        console.error('From OnlineProvider error fetching settings:', error);
        setOnline(false);
      });
  };
  
  // TODO use function to reload settings on demand
  const reloadSettings = () => {
    fetchSettings();
    // console.log('From OnlineProvider reloadSettings called');
  };

  useEffect(() => {
    fetchSettings();
    const fetchInterval = setInterval(fetchSettings, 10 * 1000);

    return () => clearInterval(fetchInterval);
  }, []);

  return (
    <OnlineContext.Provider value={{ online, setOnline }}>
      {children}
    </OnlineContext.Provider>
  );
}