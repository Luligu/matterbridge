// React
import React, { ReactNode } from "react";

interface MbfWindowProps {
  children: ReactNode;
  style?: React.CSSProperties;
}

export function MbfWindow({ children, style }: MbfWindowProps): React.JSX.Element {
  const defaultStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flex: '0 0 auto', 
    width: '100%', 
    overflow: 'hidden',
    margin: '0px',
    padding: '0px',
    gap: '0px',
    backgroundColor: 'var(--div-bg-color)',
    boxShadow: '5px 5px 10px var(--div-shadow-color)',
    border: '1px solid var(--table-border-color)',
    borderRadius: 'var(--div-border-radius)',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ ...defaultStyle, ...style }}>
      {children}
    </div>
  );
}

