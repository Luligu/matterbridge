/* eslint-disable @typescript-eslint/no-unused-vars */
/* global DocumentTouch */
import React, { useState, useEffect, useRef } from 'react';
import useWebSocket from './useWebSocket';

const detectTouchscreen = () => {
    let hasTouchscreen = false;
    if ('ontouchstart' in window || (window.DocumentTouch && document instanceof DocumentTouch)) {
        hasTouchscreen = true;
    }
    return hasTouchscreen;
  };

function WebSocketComponent(props) {
    const { wssHost, debugLevel, searchCriteria } = props;
    const [ message, setMessage ] = useState('');
    const { messages, sendMessage } = useWebSocket(wssHost, debugLevel, searchCriteria);
    const endOfMessagesRef = useRef(null); // Create a ref for scrolling purposes
    const [isHovering, setIsHovering] = useState(false); // State to track mouse hover

    // Adjust hover logic based on device type
    const handleMouseEnter = () => setIsHovering(true);
    const handleMouseLeave = () => setIsHovering(false);
    
    // Scroll to the bottom of the message list on every update, only if already at bottom
    useEffect(() => {
        if (!isHovering && !detectTouchscreen()) {
            // console.log(`isHovering: ${isHovering}`);
            endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isHovering]);

    return (
        <div style={{ margin: '0px', padding: '0px' }}>
            <ul onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                {messages.map((msg, index) => (
                    <li key={index} dangerouslySetInnerHTML={{ __html: msg }} />
                ))}
                <div ref={endOfMessagesRef} /> {/* Invisible element to mark the end */}
            </ul>
        </div>
    );
}

export default WebSocketComponent;
