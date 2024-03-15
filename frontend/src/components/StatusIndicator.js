export function StatusIndicator({ status, enabledText = 'Enabled', disabledText = undefined }) {
  if (status === undefined) {
    return (
      <div style={{ margin: '-2.5px' }}>
        <div></div>
      </div>
    );
  } else {
    return (
      <div className={status ? 'status-enabled' : 'status-disabled'}>
        {status ? enabledText : disabledText ?? enabledText}
      </div>
    );
  }
}