/*
      <span className="tooltip-text">
          {status ? enabledText : disabledText ?? enabledText}
        </span>
         title={status ? enabledText : disabledText ?? enabledText}
*/

export function StatusIndicator({ status, enabledText = 'Enabled', disabledText = undefined, tooltipText = undefined }) {
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
        <div className={status ? 'status-enabled' : 'status-disabled'}>
          {status ? enabledText : disabledText ?? enabledText}
        </div>
        <span 
          className="tooltip-text">{tooltipText}
        </span>
      </div>);
    }
    else {
      return(
      <div className={status ? 'status-enabled' : 'status-disabled'}>
        {status ? enabledText : disabledText ?? enabledText}
      </div>
      );
    }
  }
}