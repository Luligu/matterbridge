export function StatusIndicator({ status, enabledText = 'Enabled', disabledText = undefined, tooltipText = undefined, onClick }) {
  if (status === undefined) {
    return (
      <div style={{ margin: '-2.5px' }}>
        <div></div>
      </div>
    );
  } else {
    if(tooltipText !== undefined) {
      return (
      <div className="tooltip-container">
        <div className={status ? 'status-enabled' : 'status-disabled'} style={{ cursor: 'default' }} onClick={onClick}>
          {status ? enabledText : disabledText ?? enabledText}
        </div>
        <span 
          className="tooltip-text">{tooltipText}
        </span>
      </div>);
    }
    else {
      return(
      <div className={status ? 'status-enabled' : 'status-disabled'} style={{ cursor: 'default' }}>
        {status ? enabledText : disabledText ?? enabledText}
      </div>
      );
    }
  }
}