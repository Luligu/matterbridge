// React
import { useState, useEffect, useRef, useContext, useMemo, memo } from 'react';

import { debug } from '../appState';
import { WebSocketMessagesContext } from './WebSocketProvider';

type TimeoutHandle = ReturnType<typeof window.setTimeout>;

/**
 * Function to detect if the device has a touchscreen
 * @returns {boolean} True if a touchscreen is detected.
 */
const detectTouchscreen = (): boolean => {
  // DocumentTouch is a legacy interface missing from modern lib.dom typings, so narrow window locally instead of casting to any.
  const legacyWindow = window as Window & { DocumentTouch?: new () => unknown };
  if ('ontouchstart' in window || (typeof legacyWindow.DocumentTouch !== 'undefined' && document instanceof legacyWindow.DocumentTouch)) {
    if (debug) console.log(`WebSocketLogs detectTouchscreen = true`);
    return true;
  }
  if (debug) console.log(`WebSocketLogs detectTouchscreen = false`);
  return false;
};

function WebSocketLogs() {
  const { messages, logAutoScroll } = useContext(WebSocketMessagesContext);
  const [isHovering, setIsHovering] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const lastScrollTimeRef = useRef<number>(0); // throttle auto-scroll to avoid flicker
  const lastScrollTimeoutRef = useRef<TimeoutHandle | null>(null);

  // Detect touchscreen only once per component mount
  const isTouchscreen = useMemo(() => detectTouchscreen(), []);

  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => setIsHovering(false);

  // Scroll to the bottom of the message list on every update, only if the user is not hovering and not on a touchscreen
  useEffect(() => {
    if (debug) console.log(`WebSocketLogs logAutoScroll: ${logAutoScroll.current} isHovering: ${isHovering}`);
    if (logAutoScroll.current && !isHovering && !isTouchscreen) {
      const now = Date.now();
      if (now - lastScrollTimeRef.current >= 500) {
        if (debug) console.log('WebSocketLogs auto-scroll to bottom');
        lastScrollTimeRef.current = now;
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      } else {
        if (debug) console.log('WebSocketLogs auto-scroll skipped to avoid flicker');
        if (lastScrollTimeoutRef.current) {
          clearTimeout(lastScrollTimeoutRef.current);
        }
        lastScrollTimeoutRef.current = setTimeout(() => {
          endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
          lastScrollTimeRef.current = Date.now();
        }, 1000);
      }
    }
  }, [messages, logAutoScroll, isHovering, isTouchscreen]);

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
    <div style={{ margin: '0px', padding: '0px' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <ul style={{ margin: '0px', padding: '0px' }}>
        {messages.map((msg, index) => (
          <li key={index} style={{ wordWrap: 'break-word', maxHeight: '200px', overflow: 'hidden' }}>
            <span
              style={{
                marginRight: '5px',
                padding: '1px 5px',
                backgroundColor: getLevelMessageBgColor(msg.level),
                color: getLevelMessageColor(msg.level),
                fontSize: '12px',
                borderRadius: '3px',
                textAlign: 'center',
              }}
            >
              {msg.level}
            </span>
            {msg.time && <span style={{ marginRight: '3px', color: '#505050' }}>{'[' + msg.time + ']'}</span>}
            {msg.name && <span style={{ marginRight: '3px', color: '#09516d' }}>{'[' + msg.name + ']'}</span>}
            <span style={{ color: 'var(--main-log-color)' }}>{msg.message}</span>
          </li>
        ))}
        <div ref={endOfMessagesRef} />
      </ul>
    </div>
  );
}

export default memo(WebSocketLogs);
