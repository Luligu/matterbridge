/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useRef, useState, useCallback } from 'react';

// TODO: remove wssHost from WebSocketUse if no issues arise
function WebSocketUse(wssHost, ssl) {
    const [logFilterLevel, setLogFilterLevel] = useState(localStorage.getItem('logFilterLevel')??'info');
    const [logFilterSearch, setLogFilterSearch] = useState(localStorage.getItem('logFilterSearch')??'*');
    const [messages, setMessages] = useState([]);
    const ws = useRef(null);
    const retryCountRef = useRef(1);
    const maxMessages = 1000;
    const maxRetries = 10;

    const logFilterLevelRef = useRef(logFilterLevel);
    const logFilterSearchRef = useRef(logFilterSearch);

    // console.log(`WebSocketUse: wssHost: ${wssHost} ssl: ${ssl} logFilterLevel: ${logFilterLevel} logFilterSearch: ${logFilterSearch} messages: ${messages.length} available`);
    
    useEffect(() => {
        logFilterLevelRef.current = logFilterLevel;
    }, [logFilterLevel]);

    useEffect(() => {
        logFilterSearchRef.current = logFilterSearch;
    }, [logFilterSearch]);

    
    const sendMessage = useCallback((message) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(message);
        }
    }, []);

    const logMessage = useCallback((badge, message) => {
        const badgeSpan = `<span style="background-color: #5c0e91; color: white; padding: 1px 5px; font-size: 12px; border-radius: 3px;">${badge}</span>`;
        setMessages(prevMessages => [...prevMessages, badgeSpan + ' - ' + message]);
    }, []);

    const setLogFilters = useCallback((level, search) => {
        setLogFilterLevel(level);
        setLogFilterSearch(search);
        logMessage('WebSocket', `Filtering by log level "${level}" and log search "${search}"`);
    }, []);

    const connectWebSocket = useCallback(() => {
        if(wssHost === '' || wssHost === null || wssHost === undefined)  return;
        /*
        Direct http: WebSocketUse: window.location.host=localhost:8283 window.location.href=http://localhost:8283/ wssHost=ws://localhost:8283
        Direct https: WebSocketUse: window.location.host=localhost:8443 window.location.href=https://localhost:8443/ wssHost=wss://localhost:8443
        Ingress: WebSocketUse window.location.host: homeassistant.local:8123 window.location.href: http://homeassistant.local:8123/api/hassio_ingress/nD0C1__RqgwrZT_UdHObtcPNN7fCFxCjlmPQfCzVKI8/ Connecting to WebSocket: ws://homeassistant.local:8123/api/hassio_ingress/nD0C1__RqgwrZT_UdHObtcPNN7fCFxCjlmPQfCzVKI8/
        */
        // Replace "http" or "https" with "ws" or "wss"
        wssHost = window.location.href.replace(/^http/, 'ws');  
        // console.log(`WebSocketUse: window.location.host=${window.location.host} window.location.protocol=${window.location.protocol} window.location.href=${window.location.href} wssHost=${wssHost}`);
        logMessage('WebSocket', `Connecting to WebSocket: ${wssHost}`);
        ws.current = new WebSocket(wssHost);
        ws.current.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if(msg.id===undefined || msg.id!==0 || !msg.level || !msg.time || !msg.name || !msg.message) return;
                // console.log(`WebSocketUse message: ${msg.level} - ${msg.time} - ${msg.name}: ${msg.message}`);
                // console.log(`WebSocketUse logFilterLevel: "${logFilterLevelRef.current}" logFilterSearch: "${logFilterSearchRef.current}"`);
                const normalLevels = ['debug', 'info', 'notice', 'warn', 'error', 'fatal'];
                if(normalLevels.includes(msg.level)) {
                    if(logFilterLevelRef.current === 'info' && msg.level === 'debug') return;
                    if(logFilterLevelRef.current === 'notice' && (msg.level === 'debug' || msg.level === 'info')) return;
                    if(logFilterLevelRef.current === 'warn' && (msg.level === 'debug' || msg.level === 'info' || msg.level === 'notice')) return;
                    if(logFilterLevelRef.current === 'error' && (msg.level === 'debug' || msg.level === 'info' || msg.level === 'notice' || msg.level === 'warn')) return;
                    if(logFilterLevelRef.current === 'fatal' && (msg.level === 'debug' || msg.level === 'info' || msg.level === 'notice' || msg.level === 'warn' || msg.level === 'error')) return;
                }
                if( logFilterSearchRef.current !== '*' && logFilterSearchRef.current !== '' && !msg.message.toLowerCase().includes(logFilterSearchRef.current.toLowerCase()) && !msg.name.toLowerCase().includes(logFilterSearchRef.current.toLowerCase()) ) return;
                // console.log(`useWebSocket afterfilter: debugLevel: '${debugLevel}'-'${msg.subType}' searchCriteria: '${searchCriteria}'`);

                setMessages(prevMessages => {
                    // Create new array with new message
                    // const timeString = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}.${now.getMilliseconds().toString().padStart(3,'0')}`;
                    const timeString = `<span style="color: #505050;">[${msg.time}]</span>`;
                    const getsubTypeMessageBgColor = (level) => {
                        switch (level.toLowerCase()) {
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
                    const getsubTypeMessageColor = (level) => {
                        switch (level.toLowerCase()) {
                            case 'warn':
                                return 'black';
                            default:
                                return 'white'; 
                        }
                    };                
                    const coloredSubType = `<span style="background-color: ${getsubTypeMessageBgColor(msg.level)}; color: ${getsubTypeMessageColor(msg.level)}; padding: 1px 5px; font-size: 12px; border-radius: 3px;">${msg.level}</span>`;
                    const newMessage = `${coloredSubType} - ${timeString} <span style="color: #09516d;">[${msg.name}]</span>: ${msg.message}`;
                    const newMessages = [...prevMessages, newMessage];
                    // Check if the new array length exceeds the maximum allowed
                    if (newMessages.length > maxMessages) {
                        // Remove the oldest messages to maintain maxMessages count
                        return newMessages.slice(newMessages.length - maxMessages);
                    }
                    return newMessages;
                });
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`WebSocketUse error parsing message: ${error}`);
            }
        };
        ws.current.onopen = () => { 
            // console.log(`Connected to WebSocket: ${wssHost}`); 
            logMessage('WebSocket', `Connected to WebSocket: ${wssHost}`);
            retryCountRef.current = 1;
        };
        ws.current.onclose = () => { 
            // console.log(`Disconnected from WebSocket: ${wssHost}`); 
            logMessage('WebSocket', `Disconnected from WebSocket: ${wssHost}`);
            logMessage('WebSocket', `Reconnecting (attempt ${retryCountRef.current} of ${maxRetries}) to WebSocket: ${wssHost}`);
            if( retryCountRef.current === 1 ) attemptReconnect();
            else if( retryCountRef.current < maxRetries ) setTimeout(attemptReconnect, 1000 * retryCountRef.current);
            else logMessage('WebSocket', `Reconnect attempts exceeded limit of ${maxRetries} retries, refresh the page to reconnect to: ${wssHost}`);
            retryCountRef.current = retryCountRef.current + 1;
        };
        ws.current.onerror = (error) => {
            // console.error(`WebSocket error connecting to ${wssHost}`, error);
            logMessage('WebSocket', `WebSocket error connecting to ${wssHost}`);
        };
    }, [wssHost, ssl]);

    const attemptReconnect = useCallback(() => {
        connectWebSocket();
    }, [connectWebSocket]);

    useEffect(() => {
        connectWebSocket();
        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [connectWebSocket]);
    
    return { messages, sendMessage, logMessage, setLogFilters };
}

export default WebSocketUse;
