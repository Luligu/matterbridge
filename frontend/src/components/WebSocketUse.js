/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
import { useEffect, useRef, useState, useCallback } from 'react';

function WebSocketUse(wssHost) {
    const [debugLevel, setDebugLevel] = useState(localStorage.getItem('logFilterLevel')??'info');
    const [searchCriteria, setSearchCriteria] = useState(localStorage.getItem('logFilterSearch')??'*');
    const [messages, setMessages] = useState([]);
    const ws = useRef(null);
    const retryCountRef = useRef(1);
    const maxMessages = 1000;
    const maxRetries = 10;

    // console.log(`useWebSocket: wssHost: ${wssHost} debugLevel: ${debugLevel} searchCriteria: ${searchCriteria} messages ${messages.length}`);
    
    const sendMessage = useCallback((message) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(message);
        }
    }, []);

    const logMessage = useCallback((badge, message) => {
        const badgeSpan = `<span style="background-color: #5c0e91; color: white; padding: 1px 5px; font-size: 12px; border-radius: 3px;">${badge}</span>`;
        setMessages(prevMessages => [...prevMessages, badgeSpan + ' - ' + message]);
    }, []);

    // useEffect(() => {
    const connectWebSocket = useCallback(() => {
        if(wssHost === '' || wssHost === null || wssHost === undefined)  return;
        logMessage('WebSocket', `Connecting to WebSocket: ${wssHost}`);
        ws.current = new WebSocket(wssHost);
        ws.current.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            console.log(`WebSocket message: ${msg.level} - ${msg.time} - ${msg.name}: ${msg.message}`);
            // console.log(`useWebSocket prefilter: debugLevel: '${debugLevel}'-'${msg.subType}' searchCriteria: '${searchCriteria}'`);
            const normalLevels = ['debug', 'info', 'notice', 'warn', 'error', 'fatal'];
            if(normalLevels.includes(msg.level)) {
                if(debugLevel === 'info' && msg.level === 'debug') return;
                if(debugLevel === 'notice' && (msg.level === 'debug' || msg.level === 'info')) return;
                if(debugLevel === 'warn' && (msg.level === 'debug' || msg.level === 'info' || msg.level === 'notice')) return;
                if(debugLevel === 'error' && (msg.level === 'debug' || msg.level === 'info' || msg.level === 'notice' || msg.level === 'warn')) return;
                if(debugLevel === 'fatal' && (msg.level === 'debug' || msg.level === 'info' || msg.level === 'notice' || msg.level === 'warn' || msg.level === 'error')) return;
            }
            if( searchCriteria !== '*' && !msg.message.toLowerCase().includes(searchCriteria.toLowerCase()) && !msg.type.toLowerCase().includes(searchCriteria.toLowerCase()) ) return;
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
                            return 'yellow';
                        case 'error':
                        case 'fatal':    
                            return 'red';
                        case 'spawn':
                            return '#ff00d0';
                        default:
                            return 'lightblue'; // Default color if none of the cases match
                    }
                };                
                const getsubTypeMessageColor = (level) => {
                    switch (level.toLowerCase()) {
                        case 'warn':
                            return 'black';
                        default:
                            return 'white'; // Default color if none of the cases match#27509b 09516d
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
        };
        ws.current.onopen = () => { 
            console.log(`Connected to WebSocket: ${wssHost}`); 
            logMessage('WebSocket', `Connected to WebSocket: ${wssHost}`);
            retryCountRef.current = 1;
        };
        ws.current.onclose = () => { 
            console.log(`Disconnected from WebSocket: ${wssHost}`); 
            logMessage('WebSocket', `Disconnected from WebSocket: ${wssHost}`);
            logMessage('WebSocket', `Reconnecting (attempt ${retryCountRef.current} of ${maxRetries}) to WebSocket: ${wssHost}`);
            if( retryCountRef.current === 1 ) attemptReconnect();
            else if( retryCountRef.current < maxRetries ) setTimeout(attemptReconnect, 1000 * retryCountRef.current);
            else logMessage('WebSocket', `Reconnect attempts exceeded limit of ${maxRetries} retries, giving up on WebSocket: ${wssHost}`);
            retryCountRef.current = retryCountRef.current + 1;
        };
        ws.current.onerror = (error) => {
            console.error(`WebSocket error connecting to ${wssHost}`, error);
            logMessage('WebSocket', `WebSocket error connecting to ${wssHost}`);
        };
    }, [wssHost, debugLevel, searchCriteria]);

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
    
    return { messages, sendMessage, logMessage };
}

export default WebSocketUse;
