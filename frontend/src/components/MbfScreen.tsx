// React
import { ReactNode, useEffect, useContext } from 'react';

// Frontend
import Header from './Header';
import { UiContext } from './UiProvider';
import { WebSocketContext } from './WebSocketProvider';
import { debug, enableMobile } from '../App';
// const debug = true;

export const MOBILE_WIDTH_THRESHOLD = 1200;
export const MOBILE_HEIGHT_THRESHOLD = 900;
export let viewportWidth: number;
export let viewportHeight: number;

/**
 * Returns true if the window width and height are less than the thresholds.
 * We consider a minimum of 360px in width to render the mobile layout.
 */
export function isMobile(): boolean {
  if (typeof window !== 'undefined') {
    viewportWidth = Math.floor(window.visualViewport?.width ?? window.innerWidth);
    viewportHeight = Math.floor(window.visualViewport?.height ?? window.innerHeight);
    const isMobile = viewportWidth < MOBILE_WIDTH_THRESHOLD || viewportHeight < MOBILE_HEIGHT_THRESHOLD;
    if (debug) console.log('Visual viewport (%s) width %i height %i mobile %s', window.visualViewport !== undefined, viewportWidth, viewportHeight, isMobile);
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
  const { setLogAutoScroll } = useContext(WebSocketContext);

  // Resize effect
  useEffect(() => {
    function handleResize() {
      const mobile = isMobile();
      if (mobile) {
        setLogAutoScroll(false);
        localStorage.setItem('logAutoScroll', 'false');
      }
      setMobile(mobile);
    }
    window.addEventListener('resize', handleResize);
    setMobile(isMobile());
    return () => window.removeEventListener('resize', handleResize);
  }, [setLogAutoScroll, setMobile]);

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
