// React (ConditionalTooltip)
import { ReactNode, useRef, useState } from 'react';

// @mui/material
import Tooltip from '@mui/material/Tooltip';

export interface ConditionalTooltipProps {
  title: string;
  children: ReactNode;
}

/**
 * Tooltip that only opens when its child content is visually clipped.
 *
 * Clipping detection is done by comparing scrollWidth vs clientWidth on an internal span.
 */
export function ConditionalTooltip({ title, children }: ConditionalTooltipProps) {
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);

  const handleMouseEnter = () => {
    const el = spanRef.current;
    if (!el) {
      setOpen(false);
      return;
    }
    setOpen(el.scrollWidth > el.clientWidth);
  };

  const handleMouseLeave = () => {
    setOpen(false);
  };

  const spanStyle = {
    display: 'inline-block',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  return (
    <Tooltip
      title={title}
      open={open}
      disableHoverListener
      disableFocusListener
      disableTouchListener
      slotProps={{
        tooltip: { sx: { fontSize: '14px', fontWeight: 'normal', color: '#ffffff', backgroundColor: 'var(--primary-color)' } },
      }}
    >
      <span ref={spanRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} style={spanStyle}>
        {children}
      </span>
    </Tooltip>
  );
}
