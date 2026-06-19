// React
import React, { type ReactNode, useContext } from 'react';

import { debug } from '../appState';
import { UiContext } from './UiContext';

interface MbfPageProps {
  children: ReactNode;
  style?: React.CSSProperties;
  name: string;
}

export function MbfPage({ children, style, name }: MbfPageProps): React.JSX.Element {
  // Contexts
  const { setCurrentPage } = useContext(UiContext);
  setCurrentPage(name);
  if (debug) console.log(`MbfPage: current page set to ${name}`);

  const defaultStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    margin: '0px',
    padding: '0px',
    gap: '20px',
  };

  return <div style={{ ...defaultStyle, ...style }}>{children}</div>;
}
