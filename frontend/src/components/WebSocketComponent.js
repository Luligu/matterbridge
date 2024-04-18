import React, { useState, useEffect, useRef } from 'react';
import useWebSocket from './useWebSocket';

function WebSocketComponent(props) {
    const { wssHost, debugLevel, searchCriteria } = props;
    const [ message, setMessage ] = useState('');
    const { messages, sendMessage } = useWebSocket(wssHost, debugLevel, searchCriteria);
    const endOfMessagesRef = useRef(null); // Create a ref for scrolling purposes
    const [isHovering, setIsHovering] = useState(false); // State to track mouse hover

    // console.log(`WebSocketComponent: wssHost: ${wssHost} debugLevel: ${debugLevel} searchCriteria: ${searchCriteria}`);

    // Scroll to the bottom of the message list on every update, only if already at bottom
    useEffect(() => {
        if (!isHovering) {
            // console.log(`isHovering: ${isHovering}`);
            endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isHovering]);

    return (
        <div>
            <ul style={{ margin: '10px', padding: '10px' }}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}>
                {messages.map((msg, index) => (
                    <li key={index} dangerouslySetInnerHTML={{ __html: msg }} />
                ))}
                <div ref={endOfMessagesRef} /> {/* Invisible element to mark the end */}
            </ul>
        </div>
    );
}

export default WebSocketComponent;

    /*
        <div>
            <ul style={{ margin: '10px', padding: '10px' }}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}>
                {messages.map((msg, index) => (
                    <li key={index}>{msg}</li>
                ))}
                <div ref={endOfMessagesRef} /> {// Invisible element to mark the end }
                </ul>
                </div>
                        
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
