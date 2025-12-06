// React
import React, { ReactNode } from 'react';

// @mui/material
import { IconButton, Tooltip } from '@mui/material';

// @mdi/js
import Icon from '@mdi/react';
import { mdiClose } from '@mdi/js';

// Frontend
import { enableWindows } from '../App';

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

  return <div style={{ ...defaultStyle, ...style }}>{children}</div>;
}

interface MbfWindowHeaderProps {
  children: ReactNode;
  style?: React.CSSProperties;
}

export function MbfWindowHeader({ children, style }: MbfWindowHeaderProps): React.JSX.Element {
  const defaultStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    height: '30px',
    borderBottom: '1px solid var(--table-border-color)',
    color: 'var(--header-text-color)',
    backgroundColor: 'var(--header-bg-color)',
    margin: '0px',
    padding: '0px',
    boxSizing: 'border-box',
  };

  return <div style={{ ...defaultStyle, ...style }}>{children}</div>;
}

interface MbfWindowHeaderTextProps {
  children: ReactNode;
  style?: React.CSSProperties;
}

export function MbfWindowHeaderText({ children, style }: MbfWindowHeaderTextProps): React.JSX.Element {
  const defaultStyle: React.CSSProperties = {
    color: 'var(--header-text-color)',
    backgroundColor: 'var(--header-bg-color)',
    fontSize: '16px',
    fontWeight: 'bold',
    margin: '0px',
    padding: '5px 10px',
  };

  return <div style={{ ...defaultStyle, ...style }}>{children}</div>;
}

interface MbfWindowFooterProps {
  children: ReactNode;
  style?: React.CSSProperties;
}

export function MbfWindowFooter({ children, style }: MbfWindowFooterProps): React.JSX.Element {
  const defaultStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    height: '30px',
    color: 'var(--footer-text-color)',
    backgroundColor: 'var(--footer-bg-color)',
    margin: '0px',
    padding: '0px',
    boxSizing: 'border-box',
  };

  return <div style={{ ...defaultStyle, ...style }}>{children}</div>;
}

interface MbfWindowFooterTextProps {
  children: ReactNode;
  style?: React.CSSProperties;
}

export function MbfWindowFooterText({ children, style }: MbfWindowFooterTextProps): React.JSX.Element {
  const defaultStyle: React.CSSProperties = {
    color: 'var(--footer-text-color)',
    backgroundColor: 'var(--footer-bg-color)',
    fontSize: '14px',
    fontWeight: 'bold',
    margin: '0px',
    padding: '5px 10px',
  };

  return <div style={{ ...defaultStyle, ...style }}>{children}</div>;
}

interface MbfWindowTextProps {
  children: ReactNode;
  style?: React.CSSProperties;
}

export function MbfWindowText({ children, style }: MbfWindowTextProps): React.JSX.Element {
  const defaultStyle: React.CSSProperties = {
    color: 'var(--div-text-color)',
    backgroundColor: 'var(--div-bg-color)',
    fontSize: '14px',
    fontWeight: 'normal',
    margin: '0px',
    padding: '5px 10px',
  };

  return <div style={{ ...defaultStyle, ...style }}>{children}</div>;
}

interface MbfWindowContentProps {
  children: ReactNode;
  style?: React.CSSProperties;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  onDragLeave?: React.DragEventHandler<HTMLDivElement>;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
}

export function MbfWindowContent({ children, style, onDragOver, onDragLeave, onDrop }: MbfWindowContentProps): React.JSX.Element {
  const defaultStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    flex: '0 0 auto',
    overflow: 'hidden',
    alignItems: 'start',
    justifyContent: 'space-between',
    margin: '0px',
    padding: '10px',
    gap: '20px',
  };

  return (
    <div style={{ ...defaultStyle, ...style }} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      {children}
    </div>
  );
}

interface MbfWindowIconsProps {
  children?: ReactNode;
  style?: React.CSSProperties;
  onClose?: () => void;
}

export function MbfWindowIcons({ children, style, onClose }: MbfWindowIconsProps): React.JSX.Element {
  const defaultStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    margin: '0px',
    padding: '0px',
    paddingRight: '10px',
    gap: '10px',
  };

  return (
    <div style={{ ...defaultStyle, ...style }}>
      {children}
      {enableWindows && onClose && (
        <IconButton style={{ margin: '0px' }} onClick={onClose}>
          <Tooltip title={`Close the window`}>
            <Icon path={mdiClose} size='20px' color={'var(--header-text-color)'} />
          </Tooltip>
        </IconButton>
      )}
    </div>
  );
}
