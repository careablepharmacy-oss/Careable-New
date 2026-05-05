import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Bottom-sheet modal for JWT email/password sign-in & sign-up.
 * Uses loginWithJWT from AuthContext (which talks to /api/auth/jwt-login or /jwt-register).
 */
const EmailAuthSheet = ({ open, onClose, onSuccess, loginWithJWT }) => {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setError('');
      setSubmitting(false);
      setShowPassword(false);
    }
  }, [open]);

  const formatErr = (detail) => {
    if (!detail) return 'Something went wrong. Please try again.';
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((e) => (e && typeof e.msg === 'string' ? e.msg : JSON.stringify(e)))
        .filter(Boolean)
        .join(' ');
    }
    if (typeof detail.msg === 'string') return detail.msg;
    return String(detail);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }
    if (mode === 'register' && !name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      const user = await loginWithJWT({
        mode,
        email: email.trim().toLowerCase(),
        password,
        name: name.trim(),
      });
      onSuccess(user);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(formatErr(detail) || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      data-testid="email-auth-sheet"
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pt-5 shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="sm:hidden mx-auto mb-4 w-12 h-1.5 rounded-full bg-gray-300" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-extrabold text-[#1E3A5F]" data-testid="email-auth-title">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {mode === 'login'
                ? 'Sign in to continue your care journey'
                : 'Join Careable 360+plus today'}
            </p>
          </div>
          <button
            onClick={onClose}
            data-testid="email-auth-close-btn"
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-700" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                data-testid="email-auth-name-input"
                className="w-full pl-11 pr-4 py-3.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#2BA89F] focus:ring-2 focus:ring-[#2BA89F]/20 transition-all"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              data-testid="email-auth-email-input"
              className="w-full pl-11 pr-4 py-3.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#2BA89F] focus:ring-2 focus:ring-[#2BA89F]/20 transition-all"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              data-testid="email-auth-password-input"
              className="w-full pl-11 pr-11 py-3.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#2BA89F] focus:ring-2 focus:ring-[#2BA89F]/20 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              data-testid="email-auth-toggle-password"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <div
              data-testid="email-auth-error"
              className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            data-testid="email-auth-submit-btn"
            className="w-full bg-[#2BA89F] hover:bg-[#1E8A82] text-white py-6 text-base font-semibold rounded-xl shadow-lg disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Please wait…
              </span>
            ) : mode === 'login' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </Button>
        </form>

        {/* Toggle mode */}
        <div className="text-center mt-5 text-sm text-gray-600">
          {mode === 'login' ? (
            <>
              New to Careable 360+plus?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                data-testid="email-auth-switch-to-register"
                className="text-[#2BA89F] font-semibold hover:underline"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                data-testid="email-auth-switch-to-login"
                className="text-[#2BA89F] font-semibold hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailAuthSheet;
