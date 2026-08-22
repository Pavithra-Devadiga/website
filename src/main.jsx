import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";

if (CLERK_PUBLISHABLE_KEY) {
  Promise.all([
    import('@clerk/clerk-react'),
    import('./ClerkWrapper.jsx')
  ]).then(([{ ClerkProvider }, { default: ClerkWrapper }]) => {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
          <ClerkWrapper />
        </ClerkProvider>
      </React.StrictMode>
    );
  }).catch((err) => {
    console.warn("Clerk SDK failed to resolve dynamically. Falling back to local vault.", err);
    renderDefault();
  });
} else {
  renderDefault();
}

function renderDefault() {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App isClerkActive={false} />
    </React.StrictMode>
  );
}
