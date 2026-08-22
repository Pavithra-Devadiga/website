import React from 'react';

export default function HandshakeGraphic() {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0.9,
    }}>
      <svg 
        width="280" 
        height="280" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="var(--primary-blue)" 
        strokeWidth="1.2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="7" r="1.5" />
        <path d="M12 8.5v5" />
        <path d="M7 10.5h10" />
        <path d="M10 17l2-3.5 2 3.5" />
      </svg>
    </div>
  );
}
