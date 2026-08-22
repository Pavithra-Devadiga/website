import React from 'react';
import { SignIn, UserButton, useUser, useClerk } from '@clerk/clerk-react';
import App from './App.jsx';

export default function ClerkWrapper() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  if (!isLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#030712' }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          border: '3px solid rgba(0, 240, 255, 0.1)', 
          borderTopColor: 'var(--neon-cyan)', 
          borderRadius: '50%',
          animation: 'hud-spin-clockwise 1s linear infinite' 
        }}></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#030712', padding: '20px' }}>
        <SignIn routing="hash" />
      </div>
    );
  }

  return (
    <App 
      isClerkActive={true}
      clerkUser={user}
      clerkSignOut={signOut}
      clerkUserButton={<UserButton afterSignOutUrl="/" />}
    />
  );
}
