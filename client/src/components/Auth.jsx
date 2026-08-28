import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { LogIn, UserPlus, AlertCircle, Eye, EyeOff } from 'lucide-react';

import LogoModal from './LogoModal';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [message, setMessage] = useState('');
  const [showLogoModal, setShowLogoModal] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setMessage('');

    // Check Supabase allowed_users RPC first
    try {
      const { data: isAllowed, error: rpcErr } = await supabase.rpc('is_email_allowed', { check_email: email.trim() });
      if (!rpcErr && isAllowed === false) {
        setErrorMsg('Access Restricted: This Bunk Line deployment is private. Your email is not authorized.');
        setLoading(false);
        return;
      }
    } catch (e) {
      console.warn('RPC check failed, falling back:', e);
    }

    // Fallback to environment variable allowed emails whitelist if configured
    const allowedEmailsEnv = import.meta.env.VITE_ALLOWED_EMAILS;
    if (allowedEmailsEnv) {
      const allowedList = allowedEmailsEnv.split(',').map(item => item.trim().toLowerCase());
      if (!allowedList.includes(email.trim().toLowerCase())) {
        setErrorMsg('Access Restricted: This Bunk Line deployment is private. Your email is not authorized.');
        setLoading(false);
        return;
      }
    }

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (data.user && data.session) {
          setMessage('Account created! Logging in...');
        } else {
          setMessage('Sign up successful! Please check your email for confirmation.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setErrorMsg(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg px-4 py-12">
      <LogoModal isOpen={showLogoModal} onClose={() => setShowLogoModal(false)} />

      <div className="max-w-md w-full space-y-8 bg-brand-card p-8 rounded-2xl border border-brand-border shadow-xl">
        <div className="text-center flex flex-col items-center">
          <button
            type="button"
            onClick={() => setShowLogoModal(true)}
            className="group relative cursor-pointer focus:outline-none transition-transform hover:scale-105 active:scale-95"
            title="Click to view logo full screen"
          >
            <img src="/logo.png" alt="Bunk Line Logo" className="h-20 w-auto object-contain mb-3 drop-shadow-md" />
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-brand-primary opacity-0 group-hover:opacity-100 transition-opacity bg-brand-cardEl px-2 py-0.5 rounded border border-brand-border shadow-sm">
              View Logo
            </span>
          </button>
          <h1 className="text-4xl font-black tracking-tight text-brand-primary">
            Bunk Line
          </h1>
          <p className="mt-1 text-sm font-semibold text-brand-textSec">
            Track Today. Plan Smarter.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleAuth}>
          {errorMsg && (
            <div className="p-3 bg-red-950/50 border border-red-500/30 rounded-lg flex items-center text-status-danger text-sm gap-2">
              <AlertCircle size={18} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {message && (
            <div className="p-3 bg-green-950/50 border border-green-500/30 rounded-lg text-status-safe text-sm">
              {message}
            </div>
          )}

          <div className="rounded-md space-y-4">
            <div>
              <label className="block text-xs font-semibold text-brand-textSec uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 rounded-lg bg-brand-cardEl border border-brand-border text-brand-text focus:outline-none focus:border-brand-primary transition-colors text-base"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-textSec uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-brand-cardEl border border-brand-border text-brand-text focus:outline-none focus:border-brand-primary transition-colors pr-10 text-base"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-textMuted hover:text-brand-textSec transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-lg bg-brand-primary hover:bg-brand-primaryHover text-brand-text font-bold shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-base active:scale-[0.98]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-brand-text border-t-transparent rounded-full animate-spin"></div>
              ) : isSignUp ? (
                <>
                  <UserPlus size={20} />
                  <span>Create Account</span>
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg('');
              setMessage('');
            }}
            className="text-sm font-medium text-brand-primary hover:underline transition-all"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}
