import { useEffect, useRef, useState, useCallback } from 'react';

function useWebSocket(url) {
    const [messages, setMessages] = useState([]);
    const ws = useRef(null);
    const maxMessages = 500;

    useEffect(() => {
        ws.current = new WebSocket(url);
        ws.current.onmessage = (event) => {
            const msg = JSON.parse(event.data);
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
                        default:
                            return 'lightblue'; // Default color if none of the cases match
                    }
                };                
                const getsubTypeMessageColor = (subType) => {
                    switch (subType.toLowerCase()) {
                        case 'warn':
                            return 'black';
                        default:
                            return 'white'; // Default color if none of the cases match
                    }
                };                
                const coloredSubType = `<span style="background-color: ${getsubTypeMessageBgColor(msg.subType)}; color: ${getsubTypeMessageColor(msg.subType)}; padding: 1px 5px; font-size: 12px; border-radius: 3px;">${msg.subType}</span>`;
                const newMessage = `${coloredSubType} - ${timeString} <span style="color: #27509b;">[${msg.type}]</span>: ${msg.message}`;
                const newMessages = [...prevMessages, newMessage];
                // Check if the new array length exceeds the maximum allowed
                if (newMessages.length > maxMessages) {
                    // Remove the oldest messages to maintain maxMessages count
                    return newMessages.slice(newMessages.length - maxMessages);
                }
                return newMessages;
            });
        };
        ws.current.onopen = () => { console.log("connected to WebSocket:", url); ws.current.send(`Connected to WebSocket: ${url}`) };
        ws.current.onclose = () => { console.log("disconnected from WebSocket", url); };
        ws.current.onerror = (error) => console.error("WebSocket error: ", error);

        return () => {
            ws.current.close();
        };
    }, [url]);

    const sendMessage = useCallback((message) => {
        if (ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(message);
            setMessages(prevMessages => [...prevMessages, `To Server: ${message}`]);
        }
    }, []);

    return { messages, sendMessage };
}

export default useWebSocket;
