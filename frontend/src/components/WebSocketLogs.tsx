// React
import { useState, useEffect, useRef, useContext, useMemo, memo } from 'react';

// Frontend
import { WebSocketMessagesContext } from './WebSocketProvider';
import { debug } from '../App';

/**
 * Function to detect if the device has a touchscreen
 */ 
const detectTouchscreen = (): boolean => {
  if (
    'ontouchstart' in window ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (typeof (window as any).DocumentTouch !== 'undefined' && document instanceof (window as any).DocumentTouch)
  ) {
    if (debug) console.log(`WebSocketLogs detectTouchscreen = true`);
    return true;
  }
  if (debug) console.log(`WebSocketLogs detectTouchscreen = false`);
  return false;
};

function WebSocketLogs() {
  const { messages, autoScroll } = useContext(WebSocketMessagesContext);
  const [isHovering, setIsHovering] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  // Detect touchscreen only once per component mount
  const isTouchscreen = useMemo(() => detectTouchscreen(), []);

  const handleMouseEnter = (_e: React.MouseEvent<HTMLUListElement>) => setIsHovering(true);
  const handleMouseLeave = (_e: React.MouseEvent<HTMLUListElement>) => setIsHovering(false);

  // Scroll to the bottom of the message list on every update, only if the user is not hovering and not on a touchscreen
  useEffect(() => {
    if (debug) console.log(`WebSocketLogs autoScroll: ${autoScroll} isHovering: ${isHovering}`);
    if (autoScroll && !isHovering && !isTouchscreen) {
      endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isHovering, autoScroll, isTouchscreen]);

  const getLevelMessageBgColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'debug':
        return 'gray';
      case 'info':
        return '#267fb7';
      case 'notice':
        return 'green';
      case 'warn':
        return '#e9db18';
      case 'error':
        return 'red';
      case 'fatal':
        return '#ff0000';
      case 'spawn':
        return '#ff00d0';
      default:
        return '#5c0e91';
    }
  };

  const getLevelMessageColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'warn':
        return 'black';
      default:
        return 'white';
    }
  };

  return (
    <div style={{ margin: '0px', padding: '0px' }}>
      <ul
          style={{ margin: '0px', padding: '0px' }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
      >
        {messages.map((msg, index) => (
            <li key={index} style={{ wordWrap: 'break-word', maxHeight: '200px', overflow: 'hidden' }}>
              <span style={{ marginRight: '5px', padding: '1px 5px', backgroundColor: getLevelMessageBgColor(msg.level), color: getLevelMessageColor(msg.level), fontSize: '12px', borderRadius: '3px', textAlign: 'center' }}>{msg.level}</span>
              {msg.time && <span style={{ marginRight: '3px', color: '#505050' }}>{'['+msg.time+']'}</span>}
              {msg.name && <span style={{ marginRight: '3px', color: '#09516d' }}>{'['+msg.name+']'}</span>}
              <span style={{ color: 'var(--main-log-color)' }}>{msg.message}</span>
            </li>
        ))}
        <div ref={endOfMessagesRef} />
      </ul>
    </div>
  );
}

export default memo(WebSocketLogs);
