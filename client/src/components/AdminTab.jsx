import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ShieldCheck, UserPlus, Trash2, Shield, User, AlertCircle, CheckCircle2, RefreshCw, KeyRound, Lock, Eye, EyeOff, X, AlertTriangle } from 'lucide-react';

export default function AdminTab({ currentAdminEmail = 'ubalekabir29@gmail.com' }) {
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // New user form state
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [newNote, setNewNote] = useState('');

  // Two-Step Verification Modal State
  const [targetUserToDelete, setTargetUserToDelete] = useState(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifyingDelete, setVerifyingDelete] = useState(false);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState('');

  // Fetch allowed users
  const fetchAllowedUsers = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // 1. Try RPC get_all_allowed_users
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_all_allowed_users');
      if (!rpcErr && rpcData) {
        setAllowedUsers(rpcData);
        return;
      }

      // 2. Fallback to direct table query
      const { data, error } = await supabase
        .from('allowed_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllowedUsers(data || []);
    } catch (err) {
      console.error('Error fetching allowed users:', err);
      setErrorMsg(err.message || 'Failed to load allowed users list. Ensure migration SQL has been executed in Supabase.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllowedUsers();
  }, []);

  // Add new allowed email
  const handleAddAllowedUser = async (e) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    const formattedEmail = newEmail.trim().toLowerCase();

    try {
      // Try RPC first
      const { error: rpcErr } = await supabase.rpc('add_allowed_user', {
        target_email: formattedEmail,
        target_role: newRole,
        target_note: newNote.trim() || null
      });

      if (rpcErr) {
        const { error } = await supabase
          .from('allowed_users')
          .insert([{
            email: formattedEmail,
            role: newRole,
            note: newNote.trim() || null
          }]);
        if (error) throw error;
      }

      setSuccessMsg(`Successfully granted access to ${formattedEmail}`);
      setNewEmail('');
      setNewNote('');
      setNewRole('user');
      fetchAllowedUsers();
    } catch (err) {
      console.error('Error adding allowed user:', err);
      setErrorMsg(err.message || 'Failed to add allowed email.');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle user role (User <-> Admin)
  const handleToggleRole = async (userItem) => {
    if (userItem.email === 'ubalekabir29@gmail.com') {
      alert('The primary Admin account cannot be demoted.');
      return;
    }

    const nextRole = userItem.role === 'admin' ? 'user' : 'admin';
    if (!confirm(`Are you sure you want to change ${userItem.email}'s role to ${nextRole.toUpperCase()}?`)) {
      return;
    }

    try {
      const { error: rpcErr } = await supabase.rpc('update_allowed_user_role', {
        target_id: userItem.id,
        target_role: nextRole
      });

      if (rpcErr) {
        const { error } = await supabase
          .from('allowed_users')
          .update({ role: nextRole })
          .eq('id', userItem.id);
        if (error) throw error;
      }

      setSuccessMsg(`Updated ${userItem.email} to ${nextRole.toUpperCase()}`);
      fetchAllowedUsers();
    } catch (err) {
      console.error('Error updating user role:', err);
      setErrorMsg(err.message || 'Failed to update user role.');
    }
  };

  // Open Two-Step Verification Modal
  const handleInitiateDelete = (userItem) => {
    if (userItem.email === 'ubalekabir29@gmail.com') {
      alert('The primary Admin account cannot be deleted.');
      return;
    }
    setTargetUserToDelete(userItem);
    setAdminPassword('');
    setDeleteErrorMsg('');
  };

  // Execute Password-Verified Deletion
  const handleConfirmPasswordDelete = async (e) => {
    e.preventDefault();
    if (!targetUserToDelete || !adminPassword) return;

    setVerifyingDelete(true);
    setDeleteErrorMsg('');

    try {
      // 1. Re-authenticate admin with Supabase to verify password
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: currentAdminEmail || 'ubalekabir29@gmail.com',
        password: adminPassword
      });

      if (authErr) {
        throw new Error('Incorrect admin password. Access revocation cancelled.');
      }

      // 2. Perform deletion
      const { error: rpcErr } = await supabase.rpc('delete_allowed_user', {
        target_id: targetUserToDelete.id
      });

      if (rpcErr) {
        const { error } = await supabase
          .from('allowed_users')
          .delete()
          .eq('id', targetUserToDelete.id);
        if (error) throw error;
      }

      setSuccessMsg(`Successfully revoked access for ${targetUserToDelete.email}`);
      setTargetUserToDelete(null);
      setAdminPassword('');
      fetchAllowedUsers();
    } catch (err) {
      console.error('Error during password-verified deletion:', err);
      setDeleteErrorMsg(err.message || 'Failed to verify password.');
    } finally {
      setVerifyingDelete(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-28 md:py-8 space-y-6">
      {/* Header */}
      <div className="bg-brand-card p-6 rounded-2xl border border-brand-border shadow-warm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-brand-primary" size={24} />
            <h2 className="text-2xl font-black text-brand-text tracking-tight">
              Admin Access Management
            </h2>
          </div>
          <p className="text-xs text-brand-textSec font-medium">
            Manage who is allowed to log in and use your Bunk Line deployment. Changes take effect in real time.
          </p>
        </div>

        <button
          onClick={fetchAllowedUsers}
          className="px-3.5 py-2 rounded-xl bg-brand-cardEl hover:bg-brand-border text-brand-text font-bold text-xs flex items-center justify-center gap-2 border border-brand-border transition-all active:scale-95 shrink-0"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Whitelist</span>
        </button>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-status-danger/10 border border-status-danger/30 rounded-2xl text-status-danger text-xs font-bold flex items-start gap-2.5">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span>{errorMsg}</span>
            <p className="text-[11px] opacity-80">
              Note: Make sure you have run <code className="bg-brand-card px-1.5 py-0.5 rounded font-mono">supabase/allowed_users_migration.sql</code> in your Supabase SQL Editor.
            </p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-status-safe/10 border border-status-safe/30 rounded-2xl text-status-safe text-xs font-bold flex items-center gap-2">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Form: Add Allowed Email */}
      <div className="bg-brand-card p-6 rounded-2xl border border-brand-border shadow-warm space-y-4">
        <h3 className="text-base font-extrabold text-brand-text flex items-center gap-2">
          <UserPlus size={18} className="text-brand-primary" />
          <span>Add New Allowed Email</span>
        </h3>

        <form onSubmit={handleAddAllowedUser} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <label className="block text-[10px] font-extrabold text-brand-textMuted uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="user@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-brand-cardEl border border-brand-border text-brand-text text-xs font-medium focus:outline-none focus:border-brand-primary transition-colors"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-[10px] font-extrabold text-brand-textMuted uppercase tracking-wider mb-1">
              Role
            </label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-brand-cardEl border border-brand-border text-brand-text text-xs font-bold focus:outline-none focus:border-brand-primary transition-colors"
            >
              <option value="user">User (Standard Access)</option>
              <option value="admin">Admin (Full Access & Whitelist Management)</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="block text-[10px] font-extrabold text-brand-textMuted uppercase tracking-wider mb-1">
              Note (Optional)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. CSE Classmate"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-brand-cardEl border border-brand-border text-brand-text text-xs font-medium focus:outline-none focus:border-brand-primary transition-colors"
              />
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2.5 bg-brand-primary text-white font-extrabold text-xs rounded-xl hover:bg-brand-primaryHover transition-all shrink-0 active:scale-95 disabled:opacity-50"
              >
                {submitting ? 'Adding...' : 'Grant Access'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Whitelisted Users List Table */}
      <div className="bg-brand-card rounded-2xl border border-brand-border shadow-warm overflow-hidden">
        <div className="p-5 border-b border-brand-border flex items-center justify-between">
          <h3 className="text-base font-extrabold text-brand-text flex items-center gap-2">
            <KeyRound size={18} className="text-brand-primary" />
            <span>Whitelisted Emails ({allowedUsers.length})</span>
          </h3>
        </div>

        {loading ? (
          <div className="py-12 text-center text-brand-textMuted font-bold text-xs">
            Loading allowed users list...
          </div>
        ) : allowedUsers.length === 0 ? (
          <div className="py-12 text-center text-brand-textMuted font-bold text-xs space-y-1">
            <p>No whitelisted emails found in allowed_users table.</p>
            <p className="text-[11px] text-brand-textMuted">Run the SQL migration in Supabase to seed initial accounts.</p>
          </div>
        ) : (
          <div className="divide-y divide-brand-border/60">
            {allowedUsers.map((item) => (
              <div key={item.id} className="p-4 flex items-center justify-between gap-3 hover:bg-brand-cardEl/40 transition-colors">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-brand-text text-sm truncate">
                      {item.email}
                    </span>
                    <button
                      onClick={() => handleToggleRole(item)}
                      className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border flex items-center gap-1 transition-all ${
                        item.role === 'admin'
                          ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/30 hover:bg-brand-primary/20'
                          : 'bg-status-safe/10 text-status-safe border-status-safe/30 hover:bg-status-safe/20'
                      }`}
                      title="Click to toggle role between User and Admin"
                    >
                      {item.role === 'admin' ? <Shield size={10} /> : <User size={10} />}
                      <span>{item.role}</span>
                    </button>
                  </div>
                  {item.note && (
                    <p className="text-xs text-brand-textMuted italic">
                      "{item.note}"
                    </p>
                  )}
                  <p className="text-[10px] text-brand-textMuted">
                    Added {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>

                {item.email === 'ubalekabir29@gmail.com' ? (
                  <span className="px-2.5 py-1 text-[10px] font-extrabold text-brand-primary bg-brand-primary/10 rounded-xl border border-brand-primary/30 flex items-center gap-1 shrink-0">
                    <Lock size={12} />
                    <span>Protected Admin</span>
                  </span>
                ) : (
                  <button
                    onClick={() => handleInitiateDelete(item)}
                    className="px-3 py-1.5 text-xs font-bold text-status-danger bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/30 rounded-xl transition-all flex items-center gap-1.5 active:scale-95 shrink-0"
                    title="Revoke access with admin password verification"
                  >
                    <Trash2 size={14} />
                    <span>Revoke</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Two-Step Verification Admin Password Modal */}
      {targetUserToDelete && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-brand-card w-full max-w-md rounded-3xl border border-brand-border shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-brand-border bg-status-danger/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-status-danger">
                <div className="p-2 bg-status-danger/20 rounded-xl">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="font-black text-brand-text text-base leading-tight">Confirm Access Revocation</h3>
                  <p className="text-[11px] text-brand-textMuted font-bold">Two-step security verification</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTargetUserToDelete(null)}
                className="p-1.5 rounded-full hover:bg-brand-cardEl text-brand-textMuted hover:text-brand-text transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleConfirmPasswordDelete} className="p-6 space-y-4">
              <div className="p-3.5 bg-brand-cardEl rounded-2xl border border-brand-border space-y-1">
                <span className="text-[10px] font-extrabold text-brand-textMuted uppercase tracking-wider block">
                  Target Account
                </span>
                <p className="font-black text-brand-text text-sm break-all">
                  {targetUserToDelete.email}
                </p>
                <p className="text-[11px] text-status-danger font-medium">
                  ⚠️ This user will be immediately blocked and won't be able to log in.
                </p>
              </div>

              {deleteErrorMsg && (
                <div className="p-3 bg-status-danger/10 border border-status-danger/30 rounded-xl text-status-danger text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{deleteErrorMsg}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-brand-textMuted uppercase tracking-wider">
                  Enter Admin Password to Confirm
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="Enter your admin password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-brand-cardEl border border-brand-border text-brand-text text-xs font-medium focus:outline-none focus:border-status-danger transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-textMuted hover:text-brand-text"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-[10px] text-brand-textMuted">
                  Please enter the password for <span className="font-bold text-brand-text">{currentAdminEmail}</span>.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTargetUserToDelete(null)}
                  className="py-2.5 px-4 rounded-xl bg-brand-cardEl hover:bg-brand-border border border-brand-border text-brand-textSec font-bold text-xs transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingDelete || !adminPassword}
                  className="py-2.5 px-4 rounded-xl bg-status-danger hover:bg-opacity-90 text-white font-extrabold text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} />
                  <span>{verifyingDelete ? 'Verifying...' : 'Revoke Access'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
