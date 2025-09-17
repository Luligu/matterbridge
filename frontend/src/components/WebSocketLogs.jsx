/* global DocumentTouch */

// React
import { useState, useEffect, useRef, useContext } from 'react';

// Frontend
import { WebSocketMessagesContext } from './WebSocketProvider';

const detectTouchscreen = () => {
    let hasTouchscreen = false;
    if ('ontouchstart' in window || (window.DocumentTouch && document instanceof DocumentTouch)) {
        hasTouchscreen = true;
    }
    return hasTouchscreen;
  };

export function WebSocketLogs() {
    const { messages, autoScroll } = useContext(WebSocketMessagesContext);
    const [isHovering, setIsHovering] = useState(false); // State to track mouse hover

    const endOfMessagesRef = useRef(null); // Create a ref for scrolling

    const handleMouseEnter = () => setIsHovering(true);
    const handleMouseLeave = () => setIsHovering(false);
    
    // Scroll to the bottom of the message list on every update, only if the user is not hovering and not on a touchscreen
    useEffect(() => {
        // console.log(`WebSocketLogs autoScroll: ${autoScroll} isHovering: ${isHovering}`);
        if (autoScroll && !isHovering && !detectTouchscreen()) {
            endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isHovering, autoScroll]);

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
