import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { Capacitor } from '@capacitor/core';
import EmailAuthSheet from '../components/EmailAuthSheet';

let isProcessingGlobal = false;

// 5 image slides
const IMAGE_SLIDES = [
  { src: '/splash/slide_1.jpg', alt: 'Smart Reminders' },
  { src: '/splash/slide_2.jpg', alt: 'Appointments' },
  { src: '/splash/slide_3.jpg', alt: 'Health Shopping' },
  { src: '/splash/slide_4.jpg', alt: 'Health Tracking' },
  { src: '/splash/slide_5.jpg', alt: 'Health Wallets' },
];

const AUTO_ADVANCE_MS = 4500;

const LandingPage = () => {
  const navigate = useNavigate();
  const { login, loginWithJWT } = useAuth();

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [emailSheetOpen, setEmailSheetOpen] = useState(false);

  const touchStartX = useRef(null);
  const touchEndX = useRef(null);
  const autoAdvanceTimer = useRef(null);

  // Auto-advance (loops)
  useEffect(() => {
    if (isPaused) return;
    autoAdvanceTimer.current = setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % IMAGE_SLIDES.length);
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(autoAdvanceTimer.current);
  }, [currentSlide, isPaused]);

  // OAuth callback handler (preserved)
  useEffect(() => {
    const checkOAuthCallback = () => {
      if (isProcessingGlobal) return;

      const deepLinkUrl = sessionStorage.getItem('deepLinkUrl');
      if (deepLinkUrl) {
        sessionStorage.removeItem('deepLinkUrl');
        const match = deepLinkUrl.match(/session_id=([^&\s#]+)/);
        if (match && !isProcessingGlobal) {
          isProcessingGlobal = true;
          handleOAuthCallback(match[1]);
          return;
        }
      }

      const hash = window.location.hash;
      const search = window.location.search;
      const fullUrl = window.location.href;
      let sessionId = null;

      if (hash) sessionId = new URLSearchParams(hash.substring(1)).get('session_id');
      if (!sessionId && search) sessionId = new URLSearchParams(search).get('session_id');
      if (!sessionId && fullUrl.includes('session_id=')) {
        const m = fullUrl.match(/session_id=([^&\s#]+)/);
        if (m) sessionId = m[1];
      }
      if (sessionId && !isProcessingGlobal) {
        isProcessingGlobal = true;
        handleOAuthCallback(sessionId);
      }
    };
    checkOAuthCallback();
  }, []);

  const routeAfterLogin = useCallback(async (user) => {
    window.history.replaceState(null, '', window.location.pathname);

    const storageService = (await import('../services/storageService')).default;
    const profileCompletedFlag = await storageService.getItem('profileCompleted');
    const hasCompleteProfile = user?.name && user?.phone;
    const pendingInvite = localStorage.getItem('pending_caregiver_invite');

    if (user?.role === 'prescription_manager') {
      await storageService.setItem('profileCompleted', 'true');
      navigate('/prescription-manager');
    } else if (pendingInvite && (profileCompletedFlag === 'true' || hasCompleteProfile)) {
      await storageService.setItem('profileCompleted', 'true');
      navigate(`/invite/${pendingInvite}`);
    } else if (profileCompletedFlag === 'true' || hasCompleteProfile) {
      await storageService.setItem('profileCompleted', 'true');
      navigate('/home');
    } else {
      navigate('/phone-setup');
    }
  }, [navigate]);

  const handleOAuthCallback = async (sessionId) => {
    try {
      const user = await login(sessionId);
      await routeAfterLogin(user);
    } catch (error) {
      console.error('OAuth login failed:', error);
      alert('Login failed. Please try again. Error: ' + error.message);
      isProcessingGlobal = false;
    }
  };

  const handleGoogleLogin = () => {
    let redirectUrl;
    if (Capacitor.isNativePlatform()) {
      redirectUrl = 'careable360plus://callback/';
    } else {
      redirectUrl = window.location.origin + '/';
    }
    const encodedRedirect = encodeURIComponent(redirectUrl);
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodedRedirect}`;
  };

  const handleEmailAuthSuccess = async (user) => {
    setEmailSheetOpen(false);
    await routeAfterLogin(user);
  };

  // Touch swipe
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };
  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = () => {
    if (touchStartX.current == null || touchEndX.current == null) return;
    const dx = touchStartX.current - touchEndX.current;
    if (Math.abs(dx) > 50) {
      setIsPaused(true);
      setCurrentSlide((prev) =>
        dx > 0
          ? (prev + 1) % IMAGE_SLIDES.length
          : (prev - 1 + IMAGE_SLIDES.length) % IMAGE_SLIDES.length
      );
      setTimeout(() => setIsPaused(false), 6000);
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  return (
    <>
      <div
        className="relative min-h-screen w-full overflow-hidden bg-[#0F2A47] flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        data-testid="splash-carousel"
      >
        {/* Full-bleed image carousel */}
        <div className="relative flex-1 w-full overflow-hidden">
          {IMAGE_SLIDES.map((slide, idx) => (
            <img
              key={idx}
              src={slide.src}
              alt={slide.alt}
              draggable={false}
              className={`absolute inset-0 w-full h-full object-cover select-none transition-opacity duration-700 ease-out ${
                currentSlide === idx ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
              aria-hidden={currentSlide !== idx}
            />
          ))}
          {/* Gradient overlay at bottom for legibility */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/35 via-black/10 to-transparent z-20" />
        </div>

        {/* Bottom CTA panel — present on EVERY slide */}
        <div className="relative z-30 w-full px-5 pt-3 pb-6 bg-gradient-to-b from-white/0 via-[#0F2A47]/85 to-[#0F2A47] backdrop-blur-md">
          <div className="max-w-md mx-auto w-full">
            <Button
              onClick={handleGoogleLogin}
              className="w-full bg-white text-[#1E3A5F] hover:bg-white/95 active:scale-[0.99] py-6 text-base font-semibold rounded-2xl shadow-xl border border-white/40"
              data-testid="google-login-btn"
            >
              <img
                src="https://www.google.com/favicon.ico"
                alt="Google"
                className="w-5 h-5 mr-2"
              />
              Continue with Google
            </Button>

            <button
              type="button"
              onClick={() => setEmailSheetOpen(true)}
              data-testid="email-login-btn"
              className="w-full mt-3 py-4 text-sm font-semibold text-white bg-white/10 hover:bg-white/15 active:scale-[0.99] backdrop-blur-md rounded-2xl border border-white/25 transition-all"
            >
              Sign in with Email
            </button>

            <p className="text-center text-white/70 text-[11px] mt-3">
              By continuing you agree to our Terms &amp; Privacy
            </p>
          </div>
        </div>
      </div>

      <EmailAuthSheet
        open={emailSheetOpen}
        onClose={() => setEmailSheetOpen(false)}
        onSuccess={handleEmailAuthSuccess}
        loginWithJWT={loginWithJWT}
      />
    </>
  );
};

export default LandingPage;
