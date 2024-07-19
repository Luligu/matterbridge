 
/* eslint-disable @typescript-eslint/no-unused-vars */
/* global DocumentTouch */
import React, { useState, useEffect, useRef, useContext } from 'react';
import WebSocketUse from './WebSocketUse';
import { WebSocketContext } from './WebSocketContext';

const detectTouchscreen = () => {
    let hasTouchscreen = false;
    if ('ontouchstart' in window || (window.DocumentTouch && document instanceof DocumentTouch)) {
        hasTouchscreen = true;
    }
    return hasTouchscreen;
  };

function WebSocketComponent(props) {
    const { wssHost, debugLevel, searchCriteria } = props;
    // const { messages, sendMessage } = useWebSocket(wssHost, debugLevel, searchCriteria);
    const { messages, sendMessage } = useContext(WebSocketContext);
    // console.log('WebSocketComponent: consuming messages', messages.length);

    const endOfMessagesRef = useRef(null); // Create a ref for scrolling purposes
    const [isHovering, setIsHovering] = useState(false); // State to track mouse hover

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
