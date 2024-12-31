// @mui
import { Tooltip } from '@mui/material';

export function TruncatedText({ value, maxChars }) {
  let displayText = value;
  if (value.length > maxChars && maxChars > 3) { 
    const charsToShow = maxChars - 3; 
    const start = value.substring(0, Math.ceil(charsToShow / 2));
    const end = value.substring(value.length - Math.floor(charsToShow / 2), value.length);
    displayText = `${start} … ${end}`;
  }
  if(value !== displayText) return (
    <Tooltip title={value} placement="top" PopperProps={{
      modifiers: [
        {
          name: 'offset',
          options: {
            offset: [0, 12], 
          },
        },
      ],
    }}>
      <span>{displayText}</span>
    </Tooltip>
  )
  else return <span>{displayText}</span>
}