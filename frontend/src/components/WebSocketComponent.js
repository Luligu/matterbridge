import React, { useState } from 'react';
import useWebSocket from './useWebSocket';

function WebSocketComponent() {
    const [message, setMessage] = useState('');
    const { messages, sendMessage } = useWebSocket('ws://localhost:8284');

    /*
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
    return (
        <div>
            <ul>
                {messages.map((msg, index) => (
                    <li key={index}>{msg}</li>
                ))}
            </ul>
        </div>
    );
}

export default WebSocketComponent;
