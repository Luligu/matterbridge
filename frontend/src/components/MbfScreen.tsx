// React
import { ReactNode, useState, useEffect } from "react";

// Frontend
import Header from "./Header";
import { debug } from "../App";
// const debug = true;

const MOBILE_WIDTH_THRESHOLD = 1300;
const MOBILE_HEIGHT_THRESHOLD = 1024;
export let viewportWidth: number;
export let viewportHeight: number;
export let mobile: boolean;
export let desktop: boolean;

// Returns true if the window width is less than the threshold
function isMobile(): boolean {
  if (typeof window !== 'undefined') {
    viewportWidth = Math.floor(window.visualViewport?.width ?? window.innerWidth);
    viewportHeight = Math.floor(window.visualViewport?.height ?? window.innerHeight);
    if (debug) console.log("Visual viewport width %i height %i", viewportWidth, viewportHeight);
    mobile = viewportWidth < MOBILE_WIDTH_THRESHOLD || viewportHeight < MOBILE_HEIGHT_THRESHOLD;
    desktop = !mobile;
    if (debug) console.log("Mobile %s desktop %s", mobile, desktop);
    return mobile;
  }
  return false;
}

interface MbfScreenProps {
  children: ReactNode;
}

export function MbfScreen({ children }: MbfScreenProps): React.JSX.Element {
  const [mobile, setMobile] = useState(isMobile());

  useEffect(() => {
    function handleResize() {
      setMobile(isMobile());
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if(debug) console.log('MbfScreen rendering... mobile %s desktop %s', mobile, desktop);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', width: mobile ? `${MOBILE_WIDTH_THRESHOLD}px` : 'calc(100vw - 40px)', height: mobile ? `${MOBILE_HEIGHT_THRESHOLD}px` : 'calc(100vh - 40px)', margin: '0px', padding: '20px', gap: '20px' }}>
      <Header />
      <div style={{ display: 'flex', flexDirection: 'row', width: '100%', height: 'calc(100% - 60px)', margin: '0px', padding: '0px', gap: '20px' }}>
        {children}
      </div>
    </div>
  );
}

