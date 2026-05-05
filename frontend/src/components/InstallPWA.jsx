/**
 * InstallPWA Component
 * 
 * This component is DISABLED for native apps and web.
 * The Careable 360+ app is primarily distributed as a native APK,
 * so PWA install prompts are not needed.
 */

import React from 'react';
import { Capacitor } from '@capacitor/core';

const InstallPWA = () => {
  // Completely disable PWA install prompt
  // The app is distributed as native APK, not as PWA
  
  // Always return null - no install prompt
  return null;
};

export default InstallPWA;
