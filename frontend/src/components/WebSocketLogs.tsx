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

interface WebSocketMessagesContextType {
  messages: string[];
  autoScroll: boolean;
}

function WebSocketLogsComponent() {
  const { messages, autoScroll } = useContext(WebSocketMessagesContext) as WebSocketMessagesContextType;
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

  return (
    <div style={{ margin: '0px', padding: '0px' }}>
      <ul
          style={{ margin: '0px', padding: '0px' }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
      >
        {messages.map((msg, index) => (
            <li
                key={index}
                style={{ wordWrap: 'break-word', maxHeight: '200px', overflow: 'hidden' }}
                dangerouslySetInnerHTML={{ __html: msg }}
            />
        ))}
        <div ref={endOfMessagesRef} />
      </ul>
    </div>
  );
}

export default memo(WebSocketLogsComponent);

