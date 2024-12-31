/* global DocumentTouch */

import React, { useState, useEffect, useRef, useContext } from 'react';
import { WebSocketContext } from './WebSocketProvider';

const detectTouchscreen = () => {
    let hasTouchscreen = false;
    if ('ontouchstart' in window || (window.DocumentTouch && document instanceof DocumentTouch)) {
        hasTouchscreen = true;
    }
    return hasTouchscreen;
  };

function WebSocketLogs() {
    const { messages } = useContext(WebSocketContext);
    const [isHovering, setIsHovering] = useState(false); // State to track mouse hover

    const endOfMessagesRef = useRef(null); // Create a ref for scrolling

    const handleMouseEnter = () => setIsHovering(true);
    const handleMouseLeave = () => setIsHovering(false);
    
    // Scroll to the bottom of the message list on every update, only if the user is not hovering and not on a touchscreen
    useEffect(() => {
        if (!isHovering && !detectTouchscreen()) {
            // console.log(`isHovering: ${isHovering}`);
            endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isHovering]);

    return (
        <div style={{ margin: '0px', padding: '0px' }}>
            <ul style={{ margin: '0px', padding: '0px' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                {messages.map((msg, index) => (
                    <li key={index} style={{ wordWrap: 'break-word', maxHeight: '200px', overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: msg }} />
                ))}
                <div ref={endOfMessagesRef} /> {/* Invisible element to mark the end */}
            </ul>
        </div>
    );
}

export default WebSocketLogs;
