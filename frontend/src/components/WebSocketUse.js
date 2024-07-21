/* eslint-disable no-console */
import { useEffect, useRef, useState, useCallback } from 'react';

function WebSocketUse(wssHost, debugLevel, searchCriteria) {
    const [messages, setMessages] = useState([]);
    const [retryCount, setRetryCount] = useState(0);
    const ws = useRef(null);
    const maxMessages = 1000;

    console.log(`useWebSocket: wssHost: ${wssHost} debugLevel: ${debugLevel} searchCriteria: ${searchCriteria} messages ${messages.length}`);

    // useEffect(() => {
    const connectWebSocket = useCallback(() => {
        if(wssHost === '' || wssHost === null || wssHost === undefined)  return;
        sendMessage(`Connecting to WebSocket: ${wssHost}`);
        ws.current = new WebSocket(wssHost);
        ws.current.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            // console.log(`useWebSocket prefilter: debugLevel: '${debugLevel}'-'${msg.subType}' searchCriteria: '${searchCriteria}'`);
            const normalSubTypes = ['debug', 'info', 'warn', 'error'];
            if(normalSubTypes.includes(msg.subType)) {
                if(debugLevel === 'info' && msg.subType === 'debug') return;
                if(debugLevel === 'warn' && (msg.subType === 'debug' || msg.subType === 'info')) return;
                if(debugLevel === 'error' && (msg.subType === 'debug' || msg.subType === 'info' || msg.subType === 'warn')) return;
            }
            if( searchCriteria !== '*' && !msg.message.toLowerCase().includes(searchCriteria.toLowerCase()) && !msg.type.toLowerCase().includes(searchCriteria.toLowerCase()) ) return;
            // console.log(`useWebSocket afterfilter: debugLevel: '${debugLevel}'-'${msg.subType}' searchCriteria: '${searchCriteria}'`);

            setMessages(prevMessages => {
                // Create new array with new message
                const now = new Date();
                // const timeString = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}.${now.getMilliseconds().toString().padStart(3,'0')}`;
                const timeString = `<span style="color: #505050;">[${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}.${now.getMilliseconds().toString().padStart(3,'0')}]</span>`;
                const getsubTypeMessageBgColor = (subType) => {
                    switch (subType.toLowerCase()) {
                        case 'debug':
                            return 'gray';
                        case 'info':
                            return 'green';
                        case 'warn':
                            return 'yellow';
                        case 'error':
                            return 'red';
                        case 'spawn':
                            return '#ff00d0';
                        default:
                            return 'lightblue'; // Default color if none of the cases match
                    }
                };                
                const getsubTypeMessageColor = (subType) => {
                    switch (subType.toLowerCase()) {
                        case 'warn':
                            return 'black';
                        default:
                            return 'white'; // Default color if none of the cases match#27509b 09516d
                    }
                };                
                const coloredSubType = `<span style="background-color: ${getsubTypeMessageBgColor(msg.subType)}; color: ${getsubTypeMessageColor(msg.subType)}; padding: 1px 5px; font-size: 12px; border-radius: 3px;">${msg.subType}</span>`;
                const newMessage = `${coloredSubType} - ${timeString} <span style="color: #09516d;">[${msg.type}]</span>: ${msg.message}`;
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
            sendMessage(`Connected to WebSocket: ${wssHost}`);
            setRetryCount(0);
        };
        ws.current.onclose = () => { 
            console.log(`Disconnected from WebSocket: ${wssHost}`); 
            sendMessage(`Disconnected from WebSocket: ${wssHost}`);
            attemptReconnect();
        };
        ws.current.onerror = (error) => {
            console.error(`WebSocket error: ${error}`);
            sendMessage(`WebSocket error: ${error}`) 
            attemptReconnect();
        };

        return () => {
            ws.current.close();
        };
    }, [wssHost, debugLevel, searchCriteria]);

    const attemptReconnect = useCallback(() => {
        const maxRetries = 10;
        const retryDelay = Math.min(100 * Math.pow(2, retryCount), 30000); 

        if (retryCount < maxRetries) {
            setRetryCount(retryCount + 1);
            setTimeout(() => {
                sendMessage(`Reconnecting to WebSocket: ${wssHost}`);
                connectWebSocket();
            }, retryDelay);
        } else {
            console.error('Max retries reached, could not reconnect to WebSocket.');
        }
    }, [retryCount, connectWebSocket]);

    useEffect(() => {
        connectWebSocket();
        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [connectWebSocket]);
    
    const sendMessage = useCallback((message) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(message);
        }
        const badge = `<span style="background-color: #239cb7; color: white; padding: 1px 5px; font-size: 12px; border-radius: 3px;">WebSocket</span>`;
        setMessages(prevMessages => [...prevMessages, badge + ' - ' + message]);
    }, []);

    return { messages, sendMessage };
}

export default WebSocketUse;
