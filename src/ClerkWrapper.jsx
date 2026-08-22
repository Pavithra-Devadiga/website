import React from 'react';
import { SignIn, UserButton, useUser, useClerk } from '@clerk/clerk-react';
import App from './App.jsx';
import DynamicBackground from './components/DynamicBackground';

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
      <div style={{ 
        position: 'absolute', 
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        overflow: 'hidden',
        background: '#030712'
      }}>
        <DynamicBackground isDarkMode={true} />
        
        {/* zIndex ensures the form sits on top of the background */}
        <div style={{ 
          zIndex: 10, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          width: '100%',
          padding: '20px'
        }}>
          <SignIn 
            routing="hash" 
            appearance={{
              variables: {
                colorPrimary: '#00f0ff',
                colorBackground: '#0f111c',
                colorText: '#ffffff',
                colorInputText: '#ffffff',
                colorInputBackground: 'rgba(255, 255, 255, 0.03)',
                colorTextSecondary: '#94a3b8',
                colorDanger: '#ef4444',
                fontFamily: '"Inter", sans-serif',
                borderRadius: '16px'
              },
              elements: {
                card: {
                  boxShadow: '0 20px 45px rgba(0, 0, 0, 0.5)',
                  border: '1.5px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(15, 17, 28, 0.95)',
                  backdropFilter: 'blur(10px)'
                },
                headerTitle: { color: '#00f0ff', fontSize: '1.4rem' },
                formButtonPrimary: {
                  background: 'linear-gradient(135deg, #00f0ff, #3b82f6)',
                  border: 'none',
                  boxShadow: '0 4px 15px rgba(0, 240, 255, 0.3)',
                  transition: 'all 0.2s ease',
                  fontWeight: 'bold'
                },
                socialButtonsBlockButton: {
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  background: 'rgba(255, 255, 255, 0.02)'
                },
                formFieldInput: {
                  border: '1.5px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  color: '#ffffff'
                },
                dividerLine: { background: 'rgba(255, 255, 255, 0.1)' },
                dividerText: { color: '#94a3b8' },
                footerActionLink: { color: '#00f0ff' },
                identityPreviewText: { color: '#ffffff' },
                identityPreviewEditButtonIcon: { color: '#00f0ff' }
              }
            }}
          />
        </div>
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
