import React from 'react';

export default function DynamicHeroGraphic({ isDarkMode }) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      position: 'relative',
    }}>
      <img 
        src="https://cdn.dribbble.com/userupload/22575852/file/original-ed64744cda9418053bfafcd2addbd504.gif"
        alt="Helping Hand Dynamic Animation"
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          borderRadius: '24px',
          mixBlendMode: isDarkMode ? 'screen' : 'multiply',
          filter: isDarkMode 
            ? 'invert(1) contrast(1.2) brightness(1.1) grayscale(100%)' 
            : 'contrast(1.2) brightness(1.1) grayscale(100%)',
        }}
      />
    </div>
  );
}
