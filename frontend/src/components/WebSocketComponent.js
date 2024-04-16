import React, { useState, useEffect, useRef } from 'react';
import useWebSocket from './useWebSocket';

function WebSocketComponent(props) {
    const { host, port, height } = props;
    const [message, setMessage] = useState('');
    const { messages, sendMessage } = useWebSocket(`ws://${host}:${port}`);
    const endOfMessagesRef = useRef(null); // Create a ref for scrolling purposes
    const messageListRef = useRef(null); // Ref for the message list container
    console.log(`WebSocketComponent host: ${host}, port: ${port}, height: ${height}`);

    // Scroll to the bottom of the message list on every update, only if already at bottom
    useEffect(() => {
        const messageList = messageListRef.current;
        if (messageList) {
            const { scrollHeight, scrollTop, clientHeight } = messageList;
            const isAtBottom = scrollHeight - scrollTop <= clientHeight; 
            //console.log(`ScrollHeight: ${scrollHeight}, ScrollTop: ${scrollTop}, Difference:${scrollHeight - scrollTop} ,ClientHeight: ${clientHeight}, isAtBottom: ${isAtBottom}`);
            if (isAtBottom) {
                //console.log('User is at bottom, scrolling to bottom.');
                endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
            } else {
                //console.log('User is not at bottom, not scrolling.');
            }
        }
    }, [messages]);

    return (
            <ul ref={messageListRef} style={{ margin: '10px', padding: '10px' }}>
                {messages.map((msg, index) => (
                    <li key={index}>{msg}</li>
                ))}
                <div ref={endOfMessagesRef} /> {/* Invisible element to mark the end */}
            </ul>
    );
}

export default WebSocketComponent;

    /*
        <div>
            <ul ref={messageListRef}>
                {messages.map((msg, index) => (
                    <li key={index}>{msg}</li>
                ))}
                <div ref={endOfMessagesRef} /> {}
                </ul>
                </div>
            // Scroll to the bottom of the message list on every update
    useEffect(() => {
        if (endOfMessagesRef.current) {
            endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

            <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter message"
            />
            <button onClick={() => { sendMessage(message); setMessage(''); }}>
                Send Message
            </button>
    */
