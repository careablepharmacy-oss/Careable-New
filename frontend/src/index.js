import React from "react";
import ReactDOM from "react-dom/client";
import { Capacitor } from '@capacitor/core';
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register Service Worker for PWA - ONLY on web, NOT on native Android/iOS
// Native platforms use native FCM for push notifications
// Mixing web push with native FCM causes token generation to stall/timeout
if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('[PWA] SW registered:', registration);
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute
      })
      .catch((error) => {
        console.log('[PWA] SW registration failed:', error);
      });
  });
} else if (Capacitor.isNativePlatform()) {
  console.log('[Native] Skipping service worker registration - using native FCM');
}
