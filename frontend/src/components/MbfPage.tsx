// React
import React, { ReactNode } from "react";

interface MbfPageProps {
  children: ReactNode;
  style?: React.CSSProperties;
}

export function MbfPage({ children, style }: MbfPageProps): React.JSX.Element {
  const defaultStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    margin: '0px',
    padding: '0px',
    gap: '20px',
  };

  return (
    <div style={{ ...defaultStyle, ...style }}>
      {children}
    </div>
  );
}

