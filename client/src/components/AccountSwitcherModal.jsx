import React, { useState } from 'react';
import { User, Plus, Check, LogOut, X, Shield, ArrowRight, KeyRound } from 'lucide-react';
import { getSavedAccounts, removeSavedAccount } from '../utils/accountManager';

export default function AccountSwitcherModal({ 
  isOpen, 
  onClose, 
  currentEmail, 
  onSwitchAccount, 
  onAddNewAccount,
  onSignOutCurrent,
  onSignOutAll 
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const savedAccounts = getSavedAccounts();
  const cleanCurrentEmail = (currentEmail || '').trim().toLowerCase();

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newEmail || !newPassword) return;
    setLoading(true);
    setErrorMsg('');

    try {
      await onAddNewAccount(newEmail.trim(), newPassword);
      setShowAddForm(false);
      setNewEmail('');
      setNewPassword('');
    } catch (err) {
      console.error('Failed to log into new account:', err);
      setErrorMsg(err.message || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-brand-card w-full max-w-md rounded-3xl border border-brand-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-brand-border flex items-center justify-between bg-brand-card">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center font-black text-sm border border-brand-primary/20">
              <User size={18} />
            </div>
            <div>
              <h3 className="font-black text-brand-text text-base leading-tight">Switch Account</h3>
              <p className="text-[11px] text-brand-textMuted font-bold">Manage & toggle between accounts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-brand-cardEl text-brand-textMuted hover:text-brand-text transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {!showAddForm ? (
            <>
              {/* Saved Accounts List */}
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold text-brand-textMuted uppercase tracking-wider block">
                  Saved Accounts on Device
                </label>

                {savedAccounts.map((acc) => {
                  const isActive = acc.email === cleanCurrentEmail;
                  return (
                    <div
                      key={acc.email}
                      onClick={() => {
                        if (!isActive) onSwitchAccount(acc);
                      }}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-brand-primary/10 border-brand-primary/40 shadow-sm'
                          : 'bg-brand-cardEl hover:bg-brand-border/60 border-brand-border'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 border ${
                          isActive
                            ? 'bg-brand-primary text-white border-brand-primary'
                            : 'bg-brand-card text-brand-textSec border-brand-border'
                        }`}>
                          {acc.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="font-extrabold text-brand-text text-xs truncate flex items-center gap-1.5">
                            <span className="truncate">{acc.email}</span>
                            {acc.email === 'ubalekabir29@gmail.com' && (
                              <span className="px-1.5 py-0.2 bg-brand-primary/20 text-brand-primary text-[9px] font-black rounded uppercase">
                                Admin
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-brand-textMuted font-medium">
                            {isActive ? 'Current Active Account' : 'Tap to switch instantly'}
                          </p>
                        </div>
                      </div>

                      {isActive ? (
                        <span className="px-2.5 py-1 bg-brand-primary text-white text-[10px] font-black rounded-full uppercase tracking-wider flex items-center gap-1 shrink-0">
                          <Check size={12} /> Active
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSavedAccount(acc.email);
                            onClose();
                          }}
                          className="p-1.5 text-brand-textMuted hover:text-status-danger hover:bg-status-danger/10 rounded-lg transition-colors shrink-0"
                          title="Remove saved account from switcher"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full py-3 px-4 rounded-2xl bg-brand-cardEl hover:bg-brand-border border border-brand-border text-brand-primary font-extrabold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Plus size={16} />
                  <span>Log into Another Account</span>
                </button>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      onClose();
                      onSignOutCurrent();
                    }}
                    className="py-2.5 px-3 rounded-xl border border-brand-border text-brand-textMuted hover:text-status-danger hover:bg-status-danger/10 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <LogOut size={14} />
                    <span>Sign Out Current</span>
                  </button>
                  <button
                    onClick={() => {
                      onClose();
                      onSignOutAll();
                    }}
                    className="py-2.5 px-3 rounded-xl border border-brand-border text-brand-textMuted hover:text-status-danger hover:bg-status-danger/10 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <LogOut size={14} />
                    <span>Sign Out All</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Add / Log in to another account form */
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-sm text-brand-text">Log in to Second Account</h4>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-brand-primary font-bold hover:underline"
                >
                  Back to List
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 bg-status-danger/10 border border-status-danger/30 rounded-xl text-status-danger text-xs font-bold">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-extrabold text-brand-textMuted uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. ubalekabir29@gmail.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-brand-cardEl border border-brand-border text-brand-text text-xs font-medium focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-brand-textMuted uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-brand-cardEl border border-brand-border text-brand-text text-xs font-medium focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-brand-cardEl border border-brand-border text-brand-textMuted font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-brand-primary text-white font-extrabold text-xs shadow-md active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Logging in...' : 'Sign In & Save'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
