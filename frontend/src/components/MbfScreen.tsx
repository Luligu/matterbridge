// React
import { ReactNode, useEffect, useContext } from 'react';

// Frontend
import Header from './Header';
import { UiContext } from './UiProvider';
import { debug, enableMobile } from '../App';
// const debug = true;

export const MOBILE_WIDTH_THRESHOLD = 1300;
export const MOBILE_HEIGHT_THRESHOLD = 1024;
export const MOBILE_MIN_WIDTH = 360;
export const MOBILE_MAX_HEIGHT = 1000;
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
    if (debug) console.log('Visual viewport width %i height %i mobile %s', viewportWidth, viewportHeight, isMobile);
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

  // Resize effect
  useEffect(() => {
    function handleResize() {
      setMobile(isMobile());
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setMobile]);

  if (debug) console.log('MbfScreen rendering... mobile %s', mobile);

  if (enableMobile)
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: mobile ? 'visible' : 'hidden',
          width: mobile ? 'calc(100vw - 60px)' : 'calc(100vw - 40px)',
          maxWidth: mobile ? 'calc(100vw - 60px)' : 'calc(100vw - 40px)',
          height: mobile ? `${MOBILE_HEIGHT_THRESHOLD}px` : 'calc(100vh - 40px)',
          maxHeight: mobile ? `${MOBILE_HEIGHT_THRESHOLD * 2}px` : 'calc(100vh - 40px)',
          margin: '0px',
          padding: '20px',
          gap: '20px',
        }}
      >
        <Header />
        <div style={{ display: 'flex', flexDirection: 'row', width: '100%', height: 'calc(100% - 60px)', margin: '0px', padding: '0px', gap: '20px' }}>{children}</div>
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
