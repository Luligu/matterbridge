// React
import { type ReactNode, useEffect, useContext } from 'react';

import { debug, enableMobile } from '../appState';
import { MbfLsk } from '../utils/localStorage';
import { MOBILE_HEIGHT_THRESHOLD, MOBILE_WIDTH_THRESHOLD, setViewport } from '../viewport';
import Header from './Header';
import { UiContext } from './UiContext';
import { WebSocketContext } from './WebSocketProvider';

/**
 * Returns true if the window width and height are less than the thresholds.
 * We consider a minimum of 360px in width to render the mobile layout.
 * @returns {boolean} True when the viewport is below the mobile thresholds.
 */
// oxlint-disable-next-line react/only-export-components
export function isMobile(): boolean {
  if (typeof window !== 'undefined') {
    const width = Math.floor(window.visualViewport?.width ?? window.innerWidth);
    const height = Math.floor(window.visualViewport?.height ?? window.innerHeight);
    setViewport(width, height);
    const isMobile = width < MOBILE_WIDTH_THRESHOLD || height < MOBILE_HEIGHT_THRESHOLD;
    if (debug) console.log('Visual viewport (%s) width %i height %i mobile %s', window.visualViewport !== undefined, width, height, isMobile);
    return isMobile;
  }
  return false;
}

interface MbfScreenProps {
  children: ReactNode;
}

export function MbfScreen({ children }: MbfScreenProps): React.JSX.Element {
  // Context
  const { mobile, setMobile } = useContext(UiContext);
  // Contexts
  const { logAutoScroll } = useContext(WebSocketContext);

  // Resize effect
  useEffect(() => {
    function handleResize() {
      const mobile = isMobile();
      if (mobile) {
        logAutoScroll.current = false;
        localStorage.setItem(MbfLsk.logAutoScroll, 'false');
      }
      setMobile(mobile);
    }
    window.addEventListener('resize', handleResize);
    setMobile(isMobile());
    return () => window.removeEventListener('resize', handleResize);
  }, [logAutoScroll, setMobile]);

  if (debug) console.log('MbfScreen rendering... mobile %s', mobile);

  if (enableMobile && mobile)
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'visible',
          margin: '0px',
          padding: '10px',
          gap: '10px',
        }}
      >
        <Header />
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', margin: '0px', padding: '0px', gap: '10px' }}>{children}</div>
      </div>
    );
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        width: mobile ? `${MOBILE_WIDTH_THRESHOLD}px` : 'calc(100vw - 40px)',
        height: mobile ? `${MOBILE_HEIGHT_THRESHOLD}px` : 'calc(100vh - 40px)',
        margin: '0px',
        padding: '20px',
        gap: '20px',
      }}
    >
      <Header />
      <div style={{ display: 'flex', flexDirection: 'row', width: '100%', height: 'calc(100% - 60px)', margin: '0px', padding: '0px', gap: '20px' }}>{children}</div>
    </div>
  );
}
