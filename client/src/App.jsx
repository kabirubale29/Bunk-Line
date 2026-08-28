import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './components/Auth';
import SetupWizard from './components/SetupWizard';
import Navigation from './components/Navigation';
import TodayTab from './components/TodayTab';
import DangerZoneTab from './components/DangerZoneTab';
import StatsTab from './components/StatsTab';
import SetupTab from './components/SetupTab';
import AdminTab from './components/AdminTab';
import HistoryView from './components/HistoryView';
import PastSemestersView from './components/PastSemestersView';
import LogoModal from './components/LogoModal';

import { 
  getCache, 
  saveCache, 
  clearCache, 
  CACHE_KEYS, 
  enqueueSync, 
  processSyncQueue 
} from './db';
import { calculateAttendance } from './utils/calculations';
import { LogOut, Sun, Moon, RefreshCw } from 'lucide-react';

// Format a Date as local YYYY-MM-DD (avoids UTC offset shifting the date in UTC+ timezones like IST)
const toLocalDateStr = (d) => {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}`;
};

export default function App() {
  const [session, setSession] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);

  // Application Data States
  const [settings, setSettings] = useState({ minAttendancePct: 60, theme: 'light' });
  const [terms, setTerms] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [scheduleSlots, setScheduleSlots] = useState([]);
  const [scheduleOverrides, setScheduleOverrides] = useState([]);
  const [dayOverrides, setDayOverrides] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [alertsSeen, setAlertsSeen] = useState([]);

  // UI Navigation States
  const [activeTab, setActiveTab] = useState('today'); // 'today' | 'danger' | 'stats' | 'setup' | 'history' | 'past-semesters'
  const [historySubjectId, setHistorySubjectId] = useState('all');
  const [activeDateStr, setActiveDateStr] = useState(toLocalDateStr(new Date()));
  const [lowAttendanceAlerts, setLowAttendanceAlerts] = useState([]);
  const [unmarkedDaysCount, setUnmarkedDaysCount] = useState(0);
  const [earliestUnmarkedDate, setEarliestUnmarkedDate] = useState(null);
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);
  const [showLogoModal, setShowLogoModal] = useState(false);

  // Listen for Service Worker update available
  useEffect(() => {
    const handleSWUpdate = (e) => {
      if (e.detail?.waiting) {
        setWaitingWorker(e.detail.waiting);
      }
      setSwUpdateAvailable(true);
    };
    window.addEventListener('swUpdateAvailable', handleSWUpdate);
    return () => window.removeEventListener('swUpdateAvailable', handleSWUpdate);
  }, []);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      if (userId) {
        processSyncQueue(supabase, userId).then(() => {
          fetchData(userId);
        });
      }
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [userId]);

  const [isAdmin, setIsAdmin] = useState(false);

  // Helper to validate email against Supabase allowed_users table with env fallback
  const verifyAllowedUserAndRole = async (userEmail) => {
    if (!userEmail) return false;
    const cleanEmail = userEmail.trim().toLowerCase();

    try {
      const { data: isAllowed, error: rpcErr } = await supabase.rpc('is_email_allowed', { check_email: cleanEmail });
      if (!rpcErr && typeof isAllowed === 'boolean') {
        if (!isAllowed) return false;

        // Check if admin role
        const { data: myRole, error: roleErr } = await supabase.rpc('get_my_role');
        if (!roleErr && myRole === 'admin') {
          setIsAdmin(true);
        } else {
          const { data: userRow } = await supabase
            .from('allowed_users')
            .select('role')
            .eq('email', cleanEmail)
            .maybeSingle();
          if (userRow?.role === 'admin') setIsAdmin(true);
        }
        return true;
      }
    } catch (err) {
      console.warn('Supabase allowed_users check failed, falling back:', err);
    }

    // Fallback to environment variable allowed emails whitelist if configured
    const allowedEmailsEnv = import.meta.env.VITE_ALLOWED_EMAILS;
    const adminEmails = ['kabirubale0358@gmail.com', 'ubalekabir29@gmail.com'];
    if (!allowedEmailsEnv) {
      if (adminEmails.includes(cleanEmail)) setIsAdmin(true);
      return true;
    }
    const allowedList = allowedEmailsEnv.split(',').map(item => item.trim().toLowerCase());
    const isEnvAllowed = allowedList.includes(cleanEmail);
    if (isEnvAllowed && adminEmails.includes(cleanEmail)) {
      setIsAdmin(true);
    }
    return isEnvAllowed;
  };

  // Auth Subscription
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const allowed = await verifyAllowedUserAndRole(session.user.email);
        if (!allowed) {
          alert('Access Denied: Your email is not authorized to access this private Bunk Line deployment.');
          supabase.auth.signOut();
          setSession(null);
          setUserId(null);
          setLoading(false);
          return;
        }
        setSession(session);
        setUserId(session.user.id);
        loadCachedData().then(() => {
          fetchData(session.user.id);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const allowed = await verifyAllowedUserAndRole(session.user.email);
        if (!allowed) {
          alert('Access Denied: Your email is not authorized to access this private Bunk Line deployment.');
          supabase.auth.signOut();
          setSession(null);
          setUserId(null);
          setLoading(false);
          return;
        }
        setSession(session);
        setUserId(session.user.id);
        fetchData(session.user.id);
      } else {
        setSession(null);
        setUserId(null);
        setIsAdmin(false);
        clearLocalState();
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Theme configuration
  useEffect(() => {
    const root = window.document.documentElement;
    const isDark = settings.theme === 'dark';
    if (isDark) {
      root.classList.add('dark');
      root.classList.add('dark-theme-active');
      document.body.classList.add('dark');
      document.body.style.backgroundColor = '#121214';
      document.body.style.color = '#F4F4F6';
    } else {
      root.classList.remove('dark');
      root.classList.remove('dark-theme-active');
      document.body.classList.remove('dark');
      document.body.style.backgroundColor = '#FAF9F6';
      document.body.style.color = '#1C1C1A';
    }
  }, [settings.theme]);

  // Check for unmarked classes and low-attendance crossings
  useEffect(() => {
    if (subjects.length > 0 && settings.current_term_id) {
      calculateUnmarkedClasses();
      checkLowAttendanceAlerts();
    }
  }, [subjects, scheduleSlots, attendanceRecords, dayOverrides, scheduleOverrides, settings.current_term_id]);

  const clearLocalState = () => {
    setSettings({ minAttendancePct: 60, theme: 'dark' });
    setTerms([]);
    setSubjects([]);
    setScheduleSlots([]);
    setScheduleOverrides([]);
    setDayOverrides([]);
    setAttendanceRecords([]);
    setAlertsSeen([]);
    setLowAttendanceAlerts([]);
    setUnmarkedDaysCount(0);
    setEarliestUnmarkedDate(null);
    clearCache();
  };

  // Load cache on startup to feel instant
  const loadCachedData = async () => {
    let cachedSettings = await getCache(CACHE_KEYS.SETTINGS, { minAttendancePct: 60, theme: 'light' });
    const savedPref = localStorage.getItem('bunkline_theme');
    const activeTheme = savedPref === 'dark' ? 'dark' : 'light';
    cachedSettings = { ...cachedSettings, theme: activeTheme };

    const cachedTerms = await getCache(CACHE_KEYS.TERMS, []);
    const cachedSubjects = await getCache(CACHE_KEYS.SUBJECTS, []);
    const cachedSlots = await getCache(CACHE_KEYS.SCHEDULE_SLOTS, []);
    const cachedOverrides = await getCache(CACHE_KEYS.SCHEDULE_OVERRIDES, []);
    const cachedDayOverrides = await getCache(CACHE_KEYS.DAY_OVERRIDES, []);
    const cachedRecords = await getCache(CACHE_KEYS.ATTENDANCE_RECORDS, []);
    const cachedAlerts = await getCache(CACHE_KEYS.ALERTS_SEEN, []);

    setSettings(cachedSettings);
    setTerms(cachedTerms);
    setSubjects(cachedSubjects);
    setScheduleSlots(cachedSlots);
    setScheduleOverrides(cachedOverrides);
    setDayOverrides(cachedDayOverrides);
    setAttendanceRecords(cachedRecords);
    setAlertsSeen(cachedAlerts);
  };

  // Fetch online data from Supabase
  const fetchData = async (uid) => {
    try {
      // Sync any queue items first
      await processSyncQueue(supabase, uid);

      // 1. Settings
      let { data: settingsData, error: sErr } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', uid)
        .single();
      
      if (sErr && sErr.code !== 'PGRST116') throw sErr;

      // 2. Terms
      let { data: termsData } = await supabase
        .from('terms')
        .select('*')
        .eq('user_id', uid);

      // If no settings exist yet, create a default row
      if (!settingsData) {
        const defaultSettings = { user_id: uid, min_attendance_pct: 60, theme: 'light', current_term_id: null };
        const { data: newSettings } = await supabase.from('settings').upsert(defaultSettings).select().single();
        settingsData = newSettings;
      }

      // If still null (e.g., upsert failed due to permission), fall back to safe defaults
      if (!settingsData) {
        settingsData = { min_attendance_pct: 60, theme: 'light', current_term_id: null };
      }

      // Check localStorage preference: default to 'light' (Warm Paper) if not explicitly set to 'dark'
      const savedPref = localStorage.getItem('bunkline_theme');
      const activeTheme = savedPref ? savedPref : 'light';

      // Map to camelCase
      const formattedSettings = {
        minAttendancePct: settingsData.min_attendance_pct,
        theme: activeTheme,
        current_term_id: settingsData.current_term_id
      };

      setSettings(formattedSettings);
      await saveCache(CACHE_KEYS.SETTINGS, formattedSettings);

      if (termsData) {
        setTerms(termsData);
        await saveCache(CACHE_KEYS.TERMS, termsData);
      }

      const activeTermId = formattedSettings.current_term_id;
      if (activeTermId) {
        // Fetch term scoped details
        const [subs, slots, over, dayOver, records, alerts] = await Promise.all([
          supabase.from('subjects').select('*').eq('term_id', activeTermId),
          supabase.from('schedule_slots').select('*').eq('term_id', activeTermId),
          supabase.from('schedule_overrides').select('*').eq('term_id', activeTermId),
          supabase.from('day_overrides').select('*').eq('term_id', activeTermId),
          supabase.from('attendance_records').select('*').eq('term_id', activeTermId),
          supabase.from('alerts_seen').select('*').eq('user_id', uid)
        ]);

        if (subs.data) { setSubjects(subs.data); await saveCache(CACHE_KEYS.SUBJECTS, subs.data); }
        if (slots.data) { setScheduleSlots(slots.data); await saveCache(CACHE_KEYS.SCHEDULE_SLOTS, slots.data); }
        if (over.data) { setScheduleOverrides(over.data); await saveCache(CACHE_KEYS.SCHEDULE_OVERRIDES, over.data); }
        if (dayOver.data) { setDayOverrides(dayOver.data); await saveCache(CACHE_KEYS.DAY_OVERRIDES, dayOver.data); }
        if (records.data) { setAttendanceRecords(records.data); await saveCache(CACHE_KEYS.ATTENDANCE_RECORDS, records.data); }
        if (alerts.data) { setAlertsSeen(alerts.data); await saveCache(CACHE_KEYS.ALERTS_SEEN, alerts.data); }
      }
    } catch (error) {
      console.error('Error fetching online database values:', error);
    } finally {
      setLoading(false);
    }
  };

  // Onboarding Wizard complete callback
  const handleWizardComplete = async ({ term, subjects: wizardSubs, settings: wizardSettings }) => {
    setLoading(true);
    try {
      // 1. Insert Term
      const { data: termData, error: tErr } = await supabase
        .from('terms')
        .insert({
          user_id: userId,
          label: term.label,
          start_date: term.startDate
        })
        .select()
        .single();
      
      if (tErr) throw tErr;

      // 2. Insert Settings update
      const { error: sErr } = await supabase
        .from('settings')
        .update({
          min_attendance_pct: wizardSettings.minAttendancePct,
          current_term_id: termData.id
        })
        .eq('user_id', userId);

      if (sErr) throw sErr;

      // 3. Insert Subjects
      const subjectsToInsert = wizardSubs.map(s => ({
        user_id: userId,
        term_id: termData.id,
        name: s.name,
        color: s.color,
        baseline_total_held: 0,
        baseline_total_attended: 0
      }));

      const { data: newSubsData, error: subErr } = await supabase
        .from('subjects')
        .insert(subjectsToInsert)
        .select();

      if (subErr) throw subErr;

      // Refresh application data
      await fetchData(userId);
      setActiveTab('today');
    } catch (err) {
      console.error('Error initializing semester setup:', err);
      alert('Wizard setup failed to save. We have queued it locally.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to calculate unmarked classes in last 7 days
  const calculateUnmarkedClasses = () => {
    let unmarkedCount = 0;
    let earliest = null;

    const activeTerm = terms.find(t => t.id === settings.current_term_id);
    const termStartDateStr = activeTerm ? activeTerm.start_date : null;

    const today = new Date();
    // Look back up to 7 days, but never before term start date
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = toLocalDateStr(d);

      // Skip dates before active term start_date
      if (termStartDateStr && dateStr < termStartDateStr) {
        continue;
      }

      // Check if day is holiday
      const isDayHoliday = dayOverrides.some(o => o.date === dateStr && o.type === 'holiday');
      if (isDayHoliday) continue;

      const weekdayName = d.toLocaleDateString([], { weekday: 'long' });
      const daySlots = scheduleSlots.filter(s => s.weekday === weekdayName);
      const dayOverridesList = scheduleOverrides.filter(o => o.date === dateStr);

      // Build classes that existed on that day
      let activeSlots = [];
      daySlots.forEach(slot => {
        const over = dayOverridesList.find(o => o.original_slot_id === slot.id);
        if (over) {
          if (over.override_type === 'delete') return;
          if (over.override_type === 'modify') {
            activeSlots.push({ ...slot, ...over });
          }
        } else {
          activeSlots.push(slot);
        }
      });
      // Add extra slots
      const extras = dayOverridesList.filter(o => o.override_type === 'add');
      extras.forEach(extra => {
        activeSlots.push({ id: `override-${extra.id}`, ...extra, isExtra: true });
      });

      // Find unmarked ones
      activeSlots.forEach(slot => {
        const hasRec = attendanceRecords.some(r => 
          r.date === dateStr && 
          (slot.isExtra ? r.override_id === slot.id.replace('override-', '') : r.slot_id === slot.id)
        );
        if (!hasRec) {
          unmarkedCount++;
          if (!earliest) {
            earliest = dateStr;
          }
        }
      });
    }

    setUnmarkedDaysCount(unmarkedCount);
    setEarliestUnmarkedDate(earliest);
  };

  // Check if any subject has dropped below min percentage
  const checkLowAttendanceAlerts = async () => {
    const alertsToFire = [];
    const minPct = settings.minAttendancePct;

    for (const sub of subjects) {
      if (sub.archived) continue;
      const subRecs = attendanceRecords.filter(r => r.subject_id === sub.id);
      const present = subRecs.filter(r => r.status === 'present').length;
      const absent = subRecs.filter(r => r.status === 'absent').length;

      const stats = calculateAttendance({
        present,
        absent,
        baseline: { totalHeld: sub.baseline_total_held, totalAttended: sub.baseline_total_attended },
        minAttendancePct: minPct
      });

      if (stats.pct !== null && stats.pct < minPct) {
        // Event key to fire alert once per threshold-crossing day event
        const todayStr = toLocalDateStr(new Date());
        const eventKey = `${sub.name}-below-${minPct}-${todayStr}`;
        const alreadySeen = alertsSeen.some(a => a.event_key === eventKey);

        if (!alreadySeen) {
          alertsToFire.push({
            id: Math.random().toString(36).substring(2, 9),
            subject_id: sub.id,
            event_key: eventKey
          });

          // Persistent upload alerts seen
          const alertPayload = { user_id: userId, subject_id: sub.id, alert_type: 'low_attendance', event_key: eventKey };
          setAlertsSeen(prev => [...prev, alertPayload]);
          await enqueueSync('alert/seen', alertPayload);
        }
      }
    }

    if (alertsToFire.length > 0) {
      setLowAttendanceAlerts(prev => [...prev, ...alertsToFire]);
      processSyncQueue(supabase, userId);
    }
  };

  const handleCloseAlert = (alertId) => {
    setLowAttendanceAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  // Attendance marking mutation (Optimistic update)
  const handleMarkAttendance = async ({ date, slot_id, override_id, subject_id, status }) => {
    const existingIndex = attendanceRecords.findIndex(r => 
      r.date === date && 
      (slot_id ? r.slot_id === slot_id : r.override_id === override_id)
    );

    const recordPayload = {
      term_id: settings.current_term_id,
      date,
      slot_id,
      override_id,
      subject_id,
      status,
      marked_at: new Date().toISOString(),
      edited: existingIndex !== -1
    };

    let updatedRecords = [...attendanceRecords];
    if (existingIndex !== -1) {
      recordPayload.id = attendanceRecords[existingIndex].id;
      updatedRecords[existingIndex] = { ...updatedRecords[existingIndex], ...recordPayload };
    } else {
      recordPayload.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
      updatedRecords.push(recordPayload);
    }

    setAttendanceRecords(updatedRecords);
    await saveCache(CACHE_KEYS.ATTENDANCE_RECORDS, updatedRecords);

    // Save to server
    await enqueueSync('attendance/upsert', recordPayload);
    processSyncQueue(supabase, userId);
  };

  // Bulk Present markers (Optimistic update)
  const handleBulkMarkPresent = async (unmarkedSlots, date) => {
    const recordsToInsert = unmarkedSlots.map(slot => ({
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      term_id: settings.current_term_id,
      date,
      slot_id: slot.isExtra ? null : (slot.override_id ? slot.original_slot_id : slot.id),
      override_id: slot.override_id || null,
      subject_id: slot.subject_id,
      status: 'present',
      marked_at: new Date().toISOString(),
      edited: false
    }));

    const updated = [...attendanceRecords, ...recordsToInsert];
    setAttendanceRecords(updated);
    await saveCache(CACHE_KEYS.ATTENDANCE_RECORDS, updated);

    // Sync queue
    for (const record of recordsToInsert) {
      await enqueueSync('attendance/upsert', record);
    }
    processSyncQueue(supabase, userId);

    return recordsToInsert.map(r => r.id);
  };

  const handleUndoBulkMark = async (recordIds) => {
    const filtered = attendanceRecords.filter(r => !recordIds.includes(r.id));
    setAttendanceRecords(filtered);
    await saveCache(CACHE_KEYS.ATTENDANCE_RECORDS, filtered);

    for (const id of recordIds) {
      await enqueueSync('attendance/delete', { id });
    }
    processSyncQueue(supabase, userId);
  };

  // Notes update
  const handleAddNote = async (date, slot_id, override_id, subject_id, note) => {
    const existingIndex = attendanceRecords.findIndex(r => 
      r.date === date && 
      (slot_id ? r.slot_id === slot_id : r.override_id === override_id)
    );

    if (existingIndex === -1) {
      // Create new record with note
      const newRecord = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
        term_id: settings.current_term_id,
        date,
        slot_id,
        override_id,
        subject_id,
        status: 'present',
        note,
        marked_at: new Date().toISOString(),
        edited: false
      };
      const updated = [...attendanceRecords, newRecord];
      setAttendanceRecords(updated);
      await saveCache(CACHE_KEYS.ATTENDANCE_RECORDS, updated);
      await enqueueSync('attendance/upsert', newRecord);
      processSyncQueue(supabase, userId);
      return;
    }

    let updated = [...attendanceRecords];
    updated[existingIndex].note = note;
    setAttendanceRecords(updated);
    await saveCache(CACHE_KEYS.ATTENDANCE_RECORDS, updated);

    await enqueueSync('attendance/upsert', updated[existingIndex]);
    processSyncQueue(supabase, userId);
  };

  // Holiday triggers
  const handleMarkHoliday = async () => {
    const newOverride = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      term_id: settings.current_term_id,
      date: activeDateStr,
      type: 'holiday'
    };

    const updated = [...dayOverrides, newOverride];
    setDayOverrides(updated);
    await saveCache(CACHE_KEYS.DAY_OVERRIDES, updated);

    await enqueueSync('day_override/create', newOverride);
    processSyncQueue(supabase, userId);
  };

  const handleUnmarkHoliday = async () => {
    const record = dayOverrides.find(o => o.date === activeDateStr && o.type === 'holiday');
    if (!record) return;

    const filtered = dayOverrides.filter(o => o.id !== record.id);
    setDayOverrides(filtered);
    await saveCache(CACHE_KEYS.DAY_OVERRIDES, filtered);

    await enqueueSync('day_override/delete', { id: record.id });
    processSyncQueue(supabase, userId);
  };

  // Time Rescheduling slot overrides
  const handleAddOverride = async (overrideData) => {
    const payload = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      term_id: settings.current_term_id,
      ...overrideData
    };

    const updated = [...scheduleOverrides, payload];
    setScheduleOverrides(updated);
    await saveCache(CACHE_KEYS.SCHEDULE_OVERRIDES, updated);

    await enqueueSync('override/create', payload);
    processSyncQueue(supabase, userId);
  };

  const handleDeleteOverride = async (overrideId) => {
    const filtered = scheduleOverrides.filter(o => o.id !== overrideId);
    setScheduleOverrides(filtered);
    await saveCache(CACHE_KEYS.SCHEDULE_OVERRIDES, filtered);

    await enqueueSync('override/delete', { id: overrideId });
    processSyncQueue(supabase, userId);
  };

  // Subjects editing
  const handleAddSubject = async (sub) => {
    const payload = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      term_id: settings.current_term_id,
      user_id: userId,
      ...sub,
      archived: false
    };

    const updated = [...subjects, payload];
    setSubjects(updated);
    await saveCache(CACHE_KEYS.SUBJECTS, updated);

    await enqueueSync('subject/create', payload);
    processSyncQueue(supabase, userId);
  };

  const handleUpdateSubject = async (id, updates) => {
    const updated = subjects.map(s => s.id === id ? { ...s, ...updates } : s);
    setSubjects(updated);
    await saveCache(CACHE_KEYS.SUBJECTS, updated);

    await enqueueSync('subject/update', { id, ...updates });
    processSyncQueue(supabase, userId);
  };

  const handleDeleteSubject = async (id) => {
    const filtered = subjects.filter(s => s.id !== id);
    setSubjects(filtered);
    await saveCache(CACHE_KEYS.SUBJECTS, filtered);

    await enqueueSync('subject/delete', { id });
    processSyncQueue(supabase, userId);
  };

  // Timetable edits
  const handleAddSlot = async (slot) => {
    const payload = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      term_id: settings.current_term_id,
      user_id: userId,
      ...slot
    };

    const updated = [...scheduleSlots, payload];
    setScheduleSlots(updated);
    await saveCache(CACHE_KEYS.SCHEDULE_SLOTS, updated);

    await enqueueSync('slot/create', payload);
    processSyncQueue(supabase, userId);
  };

  const handleDeleteSlot = async (id) => {
    const filtered = scheduleSlots.filter(s => s.id !== id);
    setScheduleSlots(filtered);
    await saveCache(CACHE_KEYS.SCHEDULE_SLOTS, filtered);

    await enqueueSync('slot/delete', { id });
    processSyncQueue(supabase, userId);
  };

  // Settings update
  const handleUpdateSettings = async (updates) => {
    const updated = { ...settings, ...updates };
    if (updates.theme) {
      localStorage.setItem('bunkline_theme', updates.theme);
    }
    setSettings(updated);
    await saveCache(CACHE_KEYS.SETTINGS, updated);

    const payload = {
      user_id: userId,
      min_attendance_pct: updated.minAttendancePct,
      theme: updated.theme,
      current_term_id: updated.current_term_id
    };

    await enqueueSync('settings/update', payload);
    processSyncQueue(supabase, userId);
  };

  // Semester Start / Archive
  const handleStartNewSemester = async ({ label, startDate, carryForward: copyForward }) => {
    setLoading(true);
    try {
      const activeTerm = terms.find(t => t.id === settings.current_term_id);
      if (activeTerm) {
        // Snapshot freeze current data
        const snapshotData = {
          subjects,
          schedule: scheduleSlots,
          records: attendanceRecords,
          slotOverrides: scheduleOverrides,
          dayOverrides
        };

        // Archive Term in DB
        const { error: archiveErr } = await supabase
          .from('terms')
          .update({
            archived_at: new Date().toISOString(),
            snapshot_data: snapshotData // make sure snapshot_data matches column name (standardized snake case)
          })
          .eq('id', activeTerm.id);
        
        if (archiveErr) throw archiveErr;
      }

      // Create new term
      const { data: newTerm, error: newTermErr } = await supabase
        .from('terms')
        .insert({
          user_id: userId,
          label,
          start_date: startDate
        })
        .select()
        .single();
      
      if (newTermErr) throw newTermErr;

      // Update activeTerm settings
      await supabase
        .from('settings')
        .update({ current_term_id: newTerm.id })
        .eq('user_id', userId);

      // Carry forward timetable structures if chosen
      if (copyForward) {
        // Clone subjects
        const clonedSubjects = subjects.map(s => ({
          user_id: userId,
          term_id: newTerm.id,
          name: s.name,
          color: s.color,
          baseline_total_held: 0,
          baseline_total_attended: 0,
          archived: false
        }));

        const { data: insertedSubs } = await supabase
          .from('subjects')
          .insert(clonedSubjects)
          .select();

        // Clone schedule slots
        if (insertedSubs && scheduleSlots.length > 0) {
          const clonedSlots = scheduleSlots.map(slot => {
            const originalSub = subjects.find(s => s.id === slot.subject_id);
            const newSub = insertedSubs.find(s => s.name === originalSub?.name);
            return {
              user_id: userId,
              term_id: newTerm.id,
              subject_id: newSub ? newSub.id : slot.subject_id,
              weekday: slot.weekday,
              period: slot.period,
              start_time: slot.start_time,
              end_time: slot.end_time
            };
          });

          await supabase.from('schedule_slots').insert(clonedSlots);
        }
      }

      // Re-fetch everything
      await fetchData(userId);
      setActiveTab('today');
    } catch (err) {
      console.error('Error starting new semester:', err);
      alert('Failed to start new semester on server. Running offline sync queue...');
    } finally {
      setLoading(false);
    }
  };

  // JSON Import & Export functions
  const handleExportData = () => {
    const backup = {
      settings,
      terms,
      subjects,
      scheduleSlots,
      scheduleOverrides,
      dayOverrides,
      attendanceRecords,
      alertsSeen,
      exportVersion: '1.0',
      exportedAt: new Date().toISOString()
    };

    const str = JSON.stringify(backup, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `bunk_line_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleImportData = async (json) => {
    setLoading(true);
    try {
      // Validate import keys
      if (!json.subjects || !json.attendanceRecords || !json.settings) {
        alert('Invalid backup file. Missing required data keys.');
        return;
      }

      // Replaces setting minAttendance
      if (json.settings) {
        await handleUpdateSettings({
          minAttendancePct: json.settings.minAttendancePct,
          theme: json.settings.theme
        });
      }

      // Batch import terms
      if (json.terms && json.terms.length > 0) {
        const termsToUpsert = json.terms.map(t => ({ ...t, user_id: userId }));
        await supabase.from('terms').upsert(termsToUpsert);
      }

      // Batch import subjects
      if (json.subjects && json.subjects.length > 0) {
        const subsToUpsert = json.subjects.map(s => ({ ...s, user_id: userId }));
        await supabase.from('subjects').upsert(subsToUpsert);
      }

      // Batch import schedule slots
      if (json.scheduleSlots && json.scheduleSlots.length > 0) {
        const slotsToUpsert = json.scheduleSlots.map(s => ({ ...s, user_id: userId }));
        await supabase.from('schedule_slots').upsert(slotsToUpsert);
      }

      // Batch import overrides
      if (json.scheduleOverrides && json.scheduleOverrides.length > 0) {
        const overToUpsert = json.scheduleOverrides.map(s => ({ ...s, user_id: userId }));
        await supabase.from('schedule_overrides').upsert(overToUpsert);
      }

      if (json.dayOverrides && json.dayOverrides.length > 0) {
        const dayToUpsert = json.dayOverrides.map(d => ({ ...d, user_id: userId }));
        await supabase.from('day_overrides').upsert(dayToUpsert);
      }

      // Batch import attendance
      if (json.attendanceRecords && json.attendanceRecords.length > 0) {
        const recordsToUpsert = json.attendanceRecords.map(r => ({ ...r, user_id: userId }));
        await supabase.from('attendance_records').upsert(recordsToUpsert);
      }

      await fetchData(userId);
      alert('Data imported successfully!');
    } catch (err) {
      console.error('Error importing backup data:', err);
      alert('Failed to import backup data fully. Check browser console.');
    } finally {
      setLoading(false);
    }
  };

  // Navigating to history actions
  const handleViewHistory = (subjectId = 'all') => {
    setHistorySubjectId(subjectId);
    setActiveTab('history');
  };

  const handleUpdateHistoryRecord = (recordId, updates) => {
    const existing = attendanceRecords.find(r => r.id === recordId);
    if (!existing) return;
    
    handleMarkAttendance({
      date: existing.date,
      slot_id: existing.slot_id,
      override_id: existing.override_id,
      subject_id: existing.subject_id,
      status: existing.status,
      ...updates
    });
  };

  const handleDeleteHistoryRecord = async (recordId, isHoliday = false) => {
    if (isHoliday) {
      const filtered = dayOverrides.filter(o => o.id !== recordId);
      setDayOverrides(filtered);
      await saveCache(CACHE_KEYS.DAY_OVERRIDES, filtered);
      await enqueueSync('day_override/delete', { id: recordId });
    } else {
      const filtered = attendanceRecords.filter(r => r.id !== recordId);
      setAttendanceRecords(filtered);
      await saveCache(CACHE_KEYS.ATTENDANCE_RECORDS, filtered);
      await enqueueSync('attendance/delete', { id: recordId });
    }
    processSyncQueue(supabase, userId);
  };

  // Sign out user
  const handleSignOut = async () => {
    if (confirm('Are you sure you want to sign out?')) {
      await supabase.auth.signOut();
      clearLocalState();
    }
  };

  // Loading indicator screen
  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center gap-4 text-brand-text">
        <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
        <h3 className="text-sm font-black tracking-widest uppercase">Loading Bunk Line</h3>
      </div>
    );
  }

  // Not authenticated screen
  if (!session) {
    return <Auth />;
  }

  // Onboarding setup wizard check
  const needsSetup = !settings.current_term_id || subjects.length === 0;
  if (needsSetup && activeTab !== 'past-semesters') {
    return <SetupWizard onComplete={handleWizardComplete} />;
  }

  return (
    <div className="min-h-screen bg-brand-bg md:pl-64 flex flex-col transition-colors pb-16 md:pb-0">
      <LogoModal isOpen={showLogoModal} onClose={() => setShowLogoModal(false)} />
      
      {/* PWA New Update Toast Banner */}
      {swUpdateAvailable && (
        <div 
          onClick={() => {
            if (waitingWorker) {
              waitingWorker.postMessage({ action: 'SKIP_WAITING' });
            }
            setTimeout(() => {
              window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
            }, 100);
          }}
          className="fixed top-3 left-3 right-3 md:left-1/2 md:-translate-x-1/2 md:max-w-md z-[99999] bg-brand-primary text-white p-3.5 rounded-2xl shadow-2xl border-2 border-white/40 flex items-center justify-between gap-2 cursor-pointer active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-2.5 text-xs font-black min-w-0">
            <RefreshCw size={18} className="shrink-0 animate-spin text-status-warning" />
            <span className="truncate">New update available! Tap to refresh.</span>
          </div>
          <button
            type="button"
            className="px-3.5 py-1.5 bg-white text-brand-primary text-xs font-black rounded-xl hover:bg-opacity-95 transition-all shrink-0 shadow-lg uppercase tracking-wider"
          >
            Update Now
          </button>
        </div>
      )}

      {/* Top Navbar Header (Desktop Only) */}
      <header className="hidden md:flex items-center justify-between h-16 border-b border-brand-border px-8 bg-brand-card sticky top-0 z-20 shadow-warm">
        <div className="flex items-center gap-3">
          <span className="text-xs font-black px-2.5 py-1 bg-brand-primary/10 text-brand-primary border border-brand-primary/20 rounded-md">
            {terms.find(t => t.id === settings.current_term_id)?.label || 'Sem Active'}
          </span>
          {online ? (
            <span className="text-[10px] text-status-safe font-black uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-status-safe animate-pulse"></span> Cloud Synced
            </span>
          ) : (
            <span className="text-[10px] text-status-warning font-black uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-status-warning"></span> Offline Cache
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleUpdateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-cardEl hover:bg-brand-border text-brand-textSec hover:text-brand-text border border-brand-border text-xs font-bold transition-all active:scale-95"
            title="Toggle Light (Warm Paper) / Dark Theme"
          >
            {settings.theme === 'dark' ? <Sun size={15} className="text-status-warning" /> : <Moon size={15} className="text-brand-primary" />}
            <span>{settings.theme === 'dark' ? 'Warm Paper' : 'Dark Mode'}</span>
          </button>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-brand-textMuted hover:text-status-danger font-extrabold hover:bg-brand-cardEl rounded-lg transition-all"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Top Navbar Header (Mobile Only) */}
      <header className="md:hidden flex items-center justify-between h-14 border-b border-brand-border px-4 bg-brand-card sticky top-0 z-20 shadow-warm">
        <button
          onClick={() => setShowLogoModal(true)}
          className="flex items-center gap-2 text-left focus:outline-none active:scale-95 transition-transform"
          title="Click to view logo full screen"
        >
          <img src="/logo.png" alt="Bunk Line" className="w-8 h-8 object-contain shrink-0" />
          <h1 className="text-lg font-black tracking-tight text-brand-primary">
            Bunk Line
          </h1>
        </button>
        <div className="flex items-center gap-2">
          {!online && (
            <span className="w-2.5 h-2.5 rounded-full bg-status-warning" title="Offline" />
          )}
          <button
            onClick={() => handleUpdateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
            className="p-2 rounded-lg bg-brand-cardEl hover:bg-brand-border text-brand-textSec hover:text-brand-text border border-brand-border transition-colors active:scale-95"
            title="Toggle Light (Warm Paper) / Dark Theme"
          >
            {settings.theme === 'dark' ? <Sun size={16} className="text-status-warning" /> : <Moon size={16} className="text-brand-primary" />}
          </button>
          <button
            onClick={handleSignOut}
            className="p-1.5 text-brand-textMuted hover:text-status-danger transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'today' && (
          <TodayTab
            subjects={subjects}
            scheduleSlots={scheduleSlots}
            records={attendanceRecords}
            overrides={scheduleOverrides}
            dayOverrides={dayOverrides}
            settings={settings}
            unmarkedDaysCount={unmarkedDaysCount}
            earliestUnmarkedDate={earliestUnmarkedDate}
            lowAttendanceAlerts={lowAttendanceAlerts}
            onMarkAttendance={handleMarkAttendance}
            onUnmarkAttendance={handleDeleteHistoryRecord}
            onBulkMarkPresent={handleBulkMarkPresent}
            onUndoBulkMark={handleUndoBulkMark}
            onMarkHoliday={handleMarkHoliday}
            onUnmarkHoliday={handleUnmarkHoliday}
            onAddOverride={handleAddOverride}
            onDeleteOverride={handleDeleteOverride}
            onNavigateToDate={(date) => setActiveDateStr(date)}
            onAddNote={handleAddNote}
            onCloseLowAttendanceAlert={handleCloseAlert}
            minAttendancePct={settings.minAttendancePct}
            activeDateStr={activeDateStr}
            setActiveDateStr={setActiveDateStr}
          />
        )}

        {activeTab === 'danger' && (
          <DangerZoneTab
            subjects={subjects}
            records={attendanceRecords}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onViewHistory={handleViewHistory}
          />
        )}

        {activeTab === 'stats' && (
          <StatsTab
            records={attendanceRecords}
            subjects={subjects}
          />
        )}

        {activeTab === 'setup' && (
          <SetupTab
            subjects={subjects}
            scheduleSlots={scheduleSlots}
            terms={terms}
            settings={settings}
            onAddSubject={handleAddSubject}
            onUpdateSubject={handleUpdateSubject}
            onDeleteSubject={handleDeleteSubject}
            onAddSlot={handleAddSlot}
            onDeleteSlot={handleDeleteSlot}
            onUpdateSettings={handleUpdateSettings}
            onStartNewSemester={handleStartNewSemester}
            onViewPastSemesters={() => setActiveTab('past-semesters')}
            onImportData={handleImportData}
            onExportData={handleExportData}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            records={attendanceRecords.filter(r => historySubjectId === 'all' || r.subject_id === historySubjectId)}
            subjects={subjects}
            overrides={scheduleOverrides}
            dayOverrides={dayOverrides}
            onBack={() => setActiveTab('danger')}
            onUpdateRecord={handleUpdateHistoryRecord}
            onDeleteRecord={handleDeleteHistoryRecord}
          />
        )}

        {activeTab === 'past-semesters' && (
          <PastSemestersView
            terms={terms}
            onBack={() => setActiveTab('setup')}
          />
        )}

        {activeTab === 'admin' && isAdmin && (
          <AdminTab />
        )}
      </main>

      {/* Navigation Layout */}
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} onOpenLogo={() => setShowLogoModal(true)} isAdmin={isAdmin} />
    </div>
  );
}
