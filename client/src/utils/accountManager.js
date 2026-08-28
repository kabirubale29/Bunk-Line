/**
 * Multi-Account Switcher Helper for Bunk Line
 * Manages saving and restoring sessions for multiple logged-in accounts.
 */

const STORAGE_KEY = 'bunkline_saved_accounts_v1';

export function getSavedAccounts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading saved accounts:', e);
    return [];
  }
}

export function saveAccountSession(session) {
  if (!session || !session.user || !session.user.email) return;

  const email = session.user.email.trim().toLowerCase();
  const currentAccounts = getSavedAccounts();

  const accountItem = {
    email,
    userId: session.user.id,
    refreshToken: session.refresh_token,
    accessToken: session.access_token,
    lastActive: Date.now(),
  };

  const existingIdx = currentAccounts.findIndex(a => a.email === email);
  if (existingIdx >= 0) {
    currentAccounts[existingIdx] = accountItem;
  } else {
    currentAccounts.push(accountItem);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentAccounts));
  } catch (e) {
    console.error('Failed to save account session:', e);
  }
}

export function removeSavedAccount(emailToRemove) {
  if (!emailToRemove) return;
  const target = emailToRemove.trim().toLowerCase();
  const current = getSavedAccounts().filter(a => a.email !== target);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    console.error('Failed to remove saved account:', e);
  }
}

export function clearAllSavedAccounts() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear saved accounts:', e);
  }
}
