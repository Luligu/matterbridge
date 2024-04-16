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
                const newMessages = [...prevMessages, `${msg.subType}-[${msg.type}]: ${msg.message}`];
                // Check if the new array length exceeds the maximum allowed
                if (newMessages.length > maxMessages) {
                    // Remove the oldest messages to maintain maxMessages count
                    return newMessages.slice(newMessages.length - maxMessages);
                }
                return newMessages;
            });
        };
        ws.current.onopen = () => console.log("connected to WebSocket");
        ws.current.onclose = () => console.log("disconnected from WebSocket");
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
