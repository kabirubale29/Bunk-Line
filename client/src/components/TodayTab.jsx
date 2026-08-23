import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check, X, Calendar, Edit2, MessageSquare, AlertTriangle, ShieldCheck, HelpCircle, Sparkles, Undo2, Award } from 'lucide-react';
import { calculateAttendance, getZoneColor } from '../utils/calculations';

export default function TodayTab({
  subjects = [],
  scheduleSlots = [],
  records = [],
  overrides = [],
  dayOverrides = [],
  settings = {},
  unmarkedDaysCount = 0,
  earliestUnmarkedDate = null,
  lowAttendanceAlerts = [],
  onMarkAttendance,
  onBulkMarkPresent,
  onUndoBulkMark,
  onMarkHoliday,
  onUnmarkHoliday,
  onAddOverride,
  onDeleteOverride,
  onNavigateToDate,
  onAddNote,
  onCloseLowAttendanceAlert,
  minAttendancePct = 60,
  activeDateStr,
  setActiveDateStr,
}) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [editingSlotId, setEditingSlotId] = useState(null); // originalSlotId or overrideId
  const [noteSlotId, setNoteSlotId] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [bunkCalcOpenId, setBunkCalcOpenId] = useState(null);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [undoableBulkMark, setUndoableBulkMark] = useState(null);

  // Reschedule form states
  const [rescheduleSlotId, setRescheduleSlotId] = useState(null); // if modifying an existing slot
  const [rescheduleSubId, setRescheduleSubId] = useState('');
  const [reschedulePeriod, setReschedulePeriod] = useState(1);
  const [rescheduleStart, setRescheduleStart] = useState('09:00');
  const [rescheduleEnd, setRescheduleEnd] = useState('10:00');
  const [rescheduleType, setRescheduleType] = useState('modify'); // 'modify' | 'delete' | 'add'

  // Update clock every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Map subjects for easy lookup
  const subjectMap = subjects.reduce((acc, sub) => {
    acc[sub.id] = sub;
    return acc;
  }, {});

  // Helper: format a Date as local YYYY-MM-DD (avoids UTC offset shifting the date)
  const toLocalDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Date parsing — parse as local midnight so weekday is always correct
  const activeDate = new Date(activeDateStr + 'T00:00:00');
  const isToday = activeDateStr === toLocalDateStr(new Date());

  const weekdayName = activeDate.toLocaleDateString([], { weekday: 'long' });
  const dateFormatted = activeDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

  // Get slots for this weekday from standard timetable
  const standardSlots = scheduleSlots.filter((s) => s.weekday === weekdayName);

  // Check if today is marked as a holiday
  const activeDayOverride = dayOverrides.find((o) => o.date === activeDateStr);
  const isHoliday = activeDayOverride?.type === 'holiday';

  // Get overrides for this specific date
  const dateOverrides = overrides.filter((o) => o.date === activeDateStr);

  // Helper: parse "HH:MM" into total minutes from midnight for sorting & comparison
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  // Helper: format 24h "HH:MM" to 12h "H:MM AM/PM"
  const formatDisplayTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const displayM = String(m).padStart(2, '0');
    return `${displayH}:${displayM} ${ampm}`;
  };

  // Build the slots for today
  let todaySlots = [];

  if (!isHoliday) {
    // 1. Process standard slots
    standardSlots.forEach((slot) => {
      const override = dateOverrides.find((o) => o.original_slot_id === slot.id);

      if (override) {
        if (override.override_type === 'delete') {
          // This slot was removed for today
          return;
        } else if (override.override_type === 'modify') {
          // Use overridden parameters
          todaySlots.push({
            ...slot,
            subject_id: override.subject_id,
            period: override.period,
            start_time: override.start_time,
            end_time: override.end_time,
            override_id: override.id,
            isModified: true,
          });
        }
      } else {
        // Keep slot as is
        todaySlots.push({
          ...slot,
          isModified: false,
        });
      }
    });

    // 2. Process added extra classes
    const extraSlots = dateOverrides.filter((o) => o.override_type === 'add');
    extraSlots.forEach((extra) => {
      todaySlots.push({
        id: `override-${extra.id}`,
        override_id: extra.id,
        subject_id: extra.subject_id,
        period: extra.period,
        start_time: extra.start_time,
        end_time: extra.end_time,
        isModified: true,
        isExtra: true,
      });
    });

    // 3. Sort chronologically by period number first, then start_time in total minutes
    todaySlots.sort((a, b) => {
      const perA = Number(a.period) || 0;
      const perB = Number(b.period) || 0;
      if (perA !== perB) return perA - perB;
      const minA = parseTimeToMinutes(a.start_time);
      const minB = parseTimeToMinutes(b.start_time);
      return minA - minB;
    });
  }

  // Determine "Now" and "Up Next" slots (only when viewing today's date)
  let nowSlotId = null;
  let upNextSlotId = null;

  if (isToday && todaySlots.length > 0) {
    const curHour = currentTime.getHours();
    const curMin = currentTime.getMinutes();
    const curMinutes = curHour * 60 + curMin;

    const slotMinutes = todaySlots.map((slot) => {
      const start = parseTimeToMinutes(slot.start_time);
      const end = parseTimeToMinutes(slot.end_time);
      return {
        id: slot.id,
        start,
        end,
      };
    });

    // Find if a class is active right now
    const active = slotMinutes.find((s) => curMinutes >= s.start && curMinutes <= s.end);
    if (active) {
      nowSlotId = active.id;
    }

    // Find the next upcoming class
    const upcoming = slotMinutes
      .filter((s) => s.start > curMinutes)
      .sort((a, b) => a.start - b.start);
    if (upcoming.length > 0) {
      upNextSlotId = upcoming[0].id;
    }
  }

  // Navigation helpers
  const handlePrevDay = () => {
    const prev = new Date(activeDate);
    prev.setDate(prev.getDate() - 1);
    setActiveDateStr(toLocalDateStr(prev));
  };

  const handleNextDay = () => {
    const next = new Date(activeDate);
    next.setDate(next.getDate() + 1);
    setActiveDateStr(toLocalDateStr(next));
  };

  const handleJumpToToday = () => {
    setActiveDateStr(toLocalDateStr(new Date()));
  };

  // Submission handler
  const handleMark = (slot, status) => {
    onMarkAttendance({
      date: activeDateStr,
      slot_id: slot.isExtra ? null : (slot.override_id ? slot.original_slot_id : slot.id),
      override_id: slot.override_id || null,
      subject_id: slot.subject_id,
      status,
    });
    setEditingSlotId(null);
  };

  // Bulk actions
  const handleBulkMark = async () => {
    const unmarkedSlots = todaySlots.filter((slot) => {
      const record = records.find(
        (r) =>
          r.date === activeDateStr &&
          (slot.isExtra
            ? r.override_id === slot.override_id
            : r.slot_id === (slot.override_id ? slot.original_slot_id : slot.id))
      );
      return !record;
    });

    if (unmarkedSlots.length === 0) return;

    const recordIds = await onBulkMarkPresent(unmarkedSlots, activeDateStr);
    setUndoableBulkMark(recordIds);

    // Auto dismiss undo after 6 seconds
    setTimeout(() => {
      setUndoableBulkMark(null);
    }, 6000);
  };

  const handleUndoBulkMark = () => {
    if (undoableBulkMark) {
      onUndoBulkMark(undoableBulkMark);
      setUndoableBulkMark(null);
    }
  };

  // Notes Overlay
  const openNoteDialog = (slot, existingNote) => {
    setNoteSlotId(slot.id);
    setNoteText(existingNote || '');
  };

  const saveNote = (slot) => {
    const slotId = slot.isExtra ? null : (slot.override_id ? slot.original_slot_id : slot.id);
    const overrideId = slot.override_id || null;
    onAddNote(activeDateStr, slotId, overrideId, slot.subject_id, noteText);
    setNoteSlotId(null);
  };

  // Timetable reschedule override dialogs
  const handleOpenReschedule = (slot = null, type = 'modify') => {
    setRescheduleType(type);
    if (slot) {
      setRescheduleSlotId(slot.id);
      setRescheduleSubId(slot.subject_id);
      setReschedulePeriod(slot.period);
      setRescheduleStart(slot.start_time);
      setRescheduleEnd(slot.end_time);
    } else {
      setRescheduleSlotId(null);
      setRescheduleSubId(subjects[0]?.id || '');
      setReschedulePeriod(1);
      setRescheduleStart('09:00');
      setRescheduleEnd('10:00');
    }
    setShowRescheduleForm(true);
  };

  const handleSaveReschedule = () => {
    if (!rescheduleSubId) {
      alert('Please select a subject.');
      return;
    }

    if (rescheduleType === 'delete') {
      const slot = todaySlots.find((s) => s.id === rescheduleSlotId);
      onAddOverride({
        date: activeDateStr,
        original_slot_id: slot.override_id ? slot.original_slot_id : slot.id,
        override_type: 'delete',
      });
    } else if (rescheduleType === 'modify') {
      const slot = todaySlots.find((s) => s.id === rescheduleSlotId);
      onAddOverride({
        date: activeDateStr,
        original_slot_id: slot.override_id ? slot.original_slot_id : slot.id,
        subject_id: rescheduleSubId,
        period: reschedulePeriod,
        start_time: rescheduleStart,
        end_time: rescheduleEnd,
        override_type: 'modify',
      });
    } else if (rescheduleType === 'add') {
      onAddOverride({
        date: activeDateStr,
        subject_id: rescheduleSubId,
        period: reschedulePeriod,
        start_time: rescheduleStart,
        end_time: rescheduleEnd,
        override_type: 'add',
      });
    }
    setShowRescheduleForm(false);
  };

  const handleRemoveOverride = (slot) => {
    if (slot.override_id) {
      onDeleteOverride(slot.override_id);
    }
  };

  // Render "Should I Bunk This?" Calculator helper
  const renderBunkCalculator = (slot) => {
    const sub = subjectMap[slot.subject_id];
    if (!sub) return null;

    const subRecords = records.filter((r) => r.subject_id === slot.subject_id);
    const present = subRecords.filter((r) => r.status === 'present').length;
    const absent = subRecords.filter((r) => r.status === 'absent').length;

    const calc = calculateAttendance({
      present,
      absent,
      baseline: {
        totalHeld: sub.baseline_total_held,
        totalAttended: sub.baseline_total_attended,
      },
      minAttendancePct,
    });

    const attendCalc = calculateAttendance({
      present: present + 1,
      absent,
      baseline: {
        totalHeld: sub.baseline_total_held,
        totalAttended: sub.baseline_total_attended,
      },
      minAttendancePct,
    });

    const bunkCalc = calculateAttendance({
      present,
      absent: absent + 1,
      baseline: {
        totalHeld: sub.baseline_total_held,
        totalAttended: sub.baseline_total_attended,
      },
      minAttendancePct,
    });

    const isBunkSafe = bunkCalc.pct >= minAttendancePct;

    return (
      <div className="bg-brand-cardEl p-3 rounded-xl border border-brand-border text-xs mt-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-brand-text flex items-center gap-1">
            <Sparkles size={12} className="text-brand-primary" />
            Should I bunk this?
          </span>
          <button
            onClick={() => setBunkCalcOpenId(null)}
            className="text-[10px] font-bold text-brand-textMuted hover:text-brand-text"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center py-1">
          <div className="bg-brand-card p-2 rounded-lg border border-brand-border/60">
            <div className="text-[10px] text-brand-textMuted font-bold">Current</div>
            <div className="font-extrabold text-brand-text mt-0.5">
              {calc.pct !== null ? `${calc.pct.toFixed(0)}%` : '—'}
            </div>
          </div>
          <div className="bg-brand-card p-2 rounded-lg border border-brand-border/60">
            <div className="text-[10px] text-brand-textMuted font-bold text-status-safe">If Attend</div>
            <div className="font-extrabold text-status-safe mt-0.5">
              {attendCalc.pct.toFixed(0)}%
            </div>
          </div>
          <div className="bg-brand-card p-2 rounded-lg border border-brand-border/60">
            <div className="text-[10px] text-brand-textMuted font-bold text-status-danger">If Bunk</div>
            <div className="font-extrabold text-status-danger mt-0.5">
              {bunkCalc.pct.toFixed(0)}%
            </div>
          </div>
        </div>

        <div
          className={`px-3 py-1.5 rounded-lg border text-center font-bold text-[10px] uppercase tracking-wide flex items-center justify-center gap-1.5 ${
            isBunkSafe
              ? 'bg-status-safe/10 border-status-safe/25 text-status-safe'
              : 'bg-status-danger/10 border-status-danger/25 text-status-danger'
          }`}
        >
          {isBunkSafe ? (
            <>
              <ShieldCheck size={12} />
              <span>🟢 Bunking is safe</span>
            </>
          ) : (
            <>
              <AlertTriangle size={12} />
              <span>🔴 Skip not advised (detention danger)</span>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-28 md:py-8 space-y-5">
      {/* 1. Low Attendance Alerts */}
      {lowAttendanceAlerts.map((alertItem) => {
        const sub = subjectMap[alertItem.subject_id];
        if (!sub) return null;
        return (
          <div
            key={alertItem.id}
            className="bg-status-danger/15 border border-status-danger/30 p-4 rounded-2xl flex items-start justify-between gap-3 text-status-danger animate-fade-in"
          >
            <div className="flex gap-2">
              <AlertTriangle size={20} className="shrink-0 mt-0.5" />
              <div>
                <h4 className="font-extrabold text-sm text-brand-text">Attendance Warning!</h4>
                <p className="text-xs text-brand-textSec mt-0.5 leading-relaxed">
                  <span className="font-bold text-brand-text">{sub.name}</span> has dropped below your{' '}
                  <span className="font-bold text-brand-text">{minAttendancePct}%</span> threshold.
                </p>
              </div>
            </div>
            <button
              onClick={() => onCloseLowAttendanceAlert(alertItem.id)}
              className="text-brand-textMuted hover:text-brand-text transition-colors p-1"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}

      {/* 2. Unmarked Days Banner */}
      {unmarkedDaysCount > 0 && (
        <div className="bg-brand-primary/10 border border-brand-primary/20 p-4 rounded-2xl flex items-center justify-between gap-4 text-brand-primary">
          <div className="flex items-center gap-3">
            <Calendar size={20} />
            <div className="text-xs font-bold leading-tight">
              You have {unmarkedDaysCount} unmarked class{unmarkedDaysCount > 1 ? 'es' : ''} in the last week.
            </div>
          </div>
          <button
            onClick={() => onNavigateToDate(earliestUnmarkedDate)}
            className="px-3.5 py-1.5 bg-brand-primary text-brand-primaryOn hover:bg-brand-primaryHover text-[10px] uppercase tracking-wider font-extrabold rounded-lg transition-all shadow-sm"
          >
            Review
          </button>
        </div>
      )}

      {/* 3. Header Date navigation */}
      <div className="bg-brand-card p-4 rounded-2xl border border-brand-border flex items-center justify-between">
        <button
          onClick={handlePrevDay}
          className="p-2 rounded-xl bg-brand-cardEl hover:bg-brand-border text-brand-textSec hover:text-brand-text transition-colors active:scale-95"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="text-center">
          <h3 className="text-lg font-black text-brand-text">{weekdayName}</h3>
          <p className="text-xs text-brand-textMuted font-bold uppercase tracking-wider mt-0.5">
            {dateFormatted}
          </p>
        </div>

        <button
          onClick={handleNextDay}
          className="p-2 rounded-xl bg-brand-cardEl hover:bg-brand-border text-brand-textSec hover:text-brand-text transition-colors active:scale-95"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 4. Sub-header Quick actions */}
      <div className="flex gap-2.5">
        {!isToday && (
          <button
            onClick={handleJumpToToday}
            className="flex-1 py-3 px-4 rounded-xl bg-brand-card hover:bg-brand-cardEl text-brand-textSec hover:text-brand-text font-bold text-xs border border-brand-border transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Calendar size={14} className="text-brand-primary" />
            <span>Back to Today</span>
          </button>
        )}

        {!isHoliday && todaySlots.length > 0 && (
          <button
            onClick={handleBulkMark}
            className="flex-grow py-3 px-4 rounded-xl bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/35 text-brand-primary font-bold text-xs transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Check size={14} />
            <span>Mark All Present</span>
          </button>
        )}

        {isHoliday ? (
          <button
            onClick={onUnmarkHoliday}
            className="flex-grow py-3 px-4 rounded-xl bg-status-warning/15 border border-status-warning/30 text-status-warning font-bold text-xs transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <X size={14} />
            <span>Unmark Holiday</span>
          </button>
        ) : (
          <button
            onClick={onMarkHoliday}
            className="flex-grow py-3 px-4 rounded-xl bg-brand-card hover:bg-brand-cardEl text-brand-textSec hover:text-brand-text font-bold text-xs border border-brand-border transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <AlertTriangle size={14} className="text-status-warning" />
            <span>Mark Holiday</span>
          </button>
        )}
      </div>

      {/* Undo snackbar container */}
      {undoableBulkMark && (
        <div className="p-3 bg-brand-cardEl border border-brand-primary/30 rounded-xl flex items-center justify-between text-xs font-bold text-brand-text animate-bounce">
          <span>Marked classes as present</span>
          <button
            onClick={handleUndoBulkMark}
            className="flex items-center gap-1 text-brand-primary hover:underline"
          >
            <Undo2 size={12} /> Undo
          </button>
        </div>
      )}

      {/* 5. Timetable list */}
      <div className="space-y-3.5">
        {isHoliday ? (
          <div className="text-center py-16 bg-brand-card rounded-2xl border border-brand-border border-dashed">
            <Award className="mx-auto text-status-warning mb-2 animate-bounce" size={40} />
            <h4 className="font-extrabold text-brand-text text-base">National / Academic Holiday</h4>
            <p className="text-xs text-brand-textMuted mt-1 px-6">
              All classes on this day are excluded from eligibility calculations.
            </p>
          </div>
        ) : todaySlots.length === 0 ? (
          <div className="text-center py-16 bg-brand-card rounded-2xl border border-brand-border border-dashed">
            <Calendar className="mx-auto text-brand-textMuted mb-2 opacity-50" size={32} />
            <h4 className="font-bold text-brand-textSec text-sm">No classes scheduled</h4>
            <p className="text-xs text-brand-textMuted mt-1 px-4">
              Sunday/Free day. Configure schedule slots in Setup Tab.
            </p>
            <button
              onClick={() => handleOpenReschedule(null, 'add')}
              className="mt-4 px-3.5 py-1.5 bg-brand-cardEl border border-brand-border rounded-lg text-brand-text hover:bg-brand-border text-xs font-semibold"
            >
              Add One-Off Class
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between text-xs font-bold text-brand-textSec px-1">
              <span>DAILY CLASSES</span>
              <button
                onClick={() => handleOpenReschedule(null, 'add')}
                className="text-brand-primary hover:underline"
              >
                + Add Override Class
              </button>
            </div>

            {todaySlots.map((slot) => {
              const sub = subjectMap[slot.subject_id];
              const record = records.find(
                (r) =>
                  r.date === activeDateStr &&
                  (slot.isExtra
                    ? r.override_id === slot.override_id
                    : r.slot_id === (slot.override_id ? slot.original_slot_id : slot.id))
              );

              const isNow = slot.id === nowSlotId;
              const isNext = slot.id === upNextSlotId;

              const isMarked = !!record;
              const isEditing = editingSlotId === slot.id;
              const isBunkOpen = bunkCalcOpenId === slot.id;

              return (
                <div
                  key={slot.id}
                  className={`bg-brand-card p-5 rounded-2xl border transition-all relative overflow-hidden shadow-warm ${
                    isNow
                      ? 'border-status-info ring-1 ring-status-info/30 bg-status-infoTint/20'
                      : isNext
                      ? 'border-brand-primary/50 bg-brand-primaryTint/20'
                      : 'border-brand-border'
                  }`}
                >
                  {/* Now / Up Next Label indicators */}
                  {isNow && (
                    <span className="absolute top-0 right-0 bg-status-info text-white px-2.5 py-0.5 rounded-bl-lg font-black text-[9px] uppercase tracking-wider shadow-sm">
                      NOW
                    </span>
                  )}
                  {isNext && (
                    <span className="absolute top-0 right-0 bg-brand-primary text-brand-primaryOn px-2.5 py-0.5 rounded-bl-lg font-black text-[9px] uppercase tracking-wider shadow-sm">
                      UP NEXT
                    </span>
                  )}

                  <div className="space-y-3.5">
                    {/* Top Row: times and period */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: sub?.color || '#6B6963' }}
                          />
                          <h4 className="font-extrabold text-brand-text text-base leading-tight">
                            {sub?.name || 'Deleted Subject'}
                          </h4>
                          {slot.isModified && (
                            <span
                              className="px-1.5 py-0.5 bg-status-infoTint text-status-info rounded text-[9px] font-black uppercase tracking-wide cursor-help"
                              title="Date-specific change override"
                            >
                              Modified
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-brand-textMuted font-bold">
                          Period {slot.period} &middot; {formatDisplayTime(slot.start_time)} – {formatDisplayTime(slot.end_time)}
                        </p>
                      </div>

                      {/* Action buttons: Note & Substitute */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => openNoteDialog(slot, record?.note)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all active:scale-95 ${
                            record?.note
                              ? 'bg-brand-primaryTint text-brand-primary border-brand-primary/30'
                              : 'bg-brand-cardEl hover:bg-brand-border border-brand-border text-brand-textSec hover:text-brand-text'
                          }`}
                          title="Add or edit note for this class"
                        >
                          <MessageSquare size={12} className={record?.note ? 'text-brand-primary' : 'text-brand-textMuted'} />
                          <span>{record?.note ? 'Edit Note' : 'Add Note'}</span>
                        </button>

                        <button
                          onClick={() => handleOpenReschedule(slot, 'modify')}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-cardEl hover:bg-brand-border border border-brand-border text-brand-textSec hover:text-brand-text text-[11px] font-bold transition-all active:scale-95"
                          title="Substitute subject or change class time for today"
                        >
                          <Edit2 size={12} className="text-brand-primary" />
                          <span>Substitute</span>
                        </button>

                        {slot.isModified && (
                          <button
                            onClick={() => handleRemoveOverride(slot)}
                            className="p-1.5 text-brand-textMuted hover:text-status-danger hover:bg-brand-cardEl rounded-lg transition-colors"
                            title="Restore standard weekly class subject"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Middle Row: Note Display Box */}
                    {record?.note && (
                      <div className="text-xs text-brand-text font-medium bg-brand-cardEl/90 p-2.5 rounded-xl border border-brand-border/60 flex items-start justify-between gap-2 shadow-sm">
                        <div className="flex items-start gap-2">
                          <MessageSquare size={13} className="shrink-0 text-brand-primary mt-0.5" />
                          <span className="leading-relaxed">"{record.note}"</span>
                        </div>
                        <button
                          onClick={() => openNoteDialog(slot, record.note)}
                          className="text-brand-textMuted hover:text-brand-primary text-[10px] font-bold shrink-0 hover:underline"
                        >
                          Edit
                        </button>
                      </div>
                    )}

                    {/* Bottom Row: Marking buttons */}
                    <div className="pt-2 border-t border-brand-border/60">
                      {!isMarked || isEditing ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleMark(slot, 'present')}
                              className="flex-1 py-2 rounded-xl bg-status-safeTint hover:bg-status-safe/20 border border-status-safe/30 text-status-safe text-xs font-bold transition-all active:scale-[0.97]"
                            >
                              Present
                            </button>
                            <button
                              onClick={() => handleMark(slot, 'absent')}
                              className="flex-1 py-2 rounded-xl bg-status-dangerTint hover:bg-status-danger/20 border border-status-danger/30 text-status-danger text-xs font-bold transition-all active:scale-[0.97]"
                            >
                              Absent
                            </button>
                            <button
                              onClick={() => handleMark(slot, 'cancelled')}
                              className="flex-1 py-2 rounded-xl bg-status-neutralTint hover:bg-status-neutral/20 border border-status-neutral/30 text-status-neutral text-xs font-bold transition-all active:scale-[0.97]"
                            >
                              Cancelled
                            </button>
                          </div>

                          <div className="flex justify-between items-center text-[10px] text-brand-textMuted font-bold">
                            <button
                              onClick={() => setBunkCalcOpenId(isBunkOpen ? null : slot.id)}
                              className="hover:underline flex items-center gap-0.5 text-brand-primary"
                            >
                              <Sparkles size={11} /> {isBunkOpen ? 'Hide Bunk Calculator' : 'Should I bunk this?'}
                            </button>

                            {isEditing && (
                              <button
                                onClick={() => setEditingSlotId(null)}
                                className="text-brand-textMuted hover:text-brand-text"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                record.status === 'present'
                                  ? 'bg-status-safeTint text-status-safe border-status-safe/30'
                                  : record.status === 'absent'
                                  ? 'bg-status-dangerTint text-status-danger border-status-danger/30'
                                  : 'bg-status-neutralTint text-status-neutral border-status-neutral/30'
                              }`}
                            >
                              {record.status}
                            </span>
                            <span className="text-[10px] text-brand-textMuted font-semibold">
                              marked {new Date(record.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => openNoteDialog(slot, record.note)}
                              className="p-1.5 text-brand-textMuted hover:text-brand-primary hover:bg-brand-cardEl transition-colors rounded-lg"
                              title="Add Note"
                            >
                              <MessageSquare size={13} />
                            </button>
                            <button
                              onClick={() => setEditingSlotId(slot.id)}
                              className="p-1.5 text-brand-textMuted hover:text-brand-text hover:bg-brand-cardEl transition-colors rounded-lg"
                              title="Edit Attendance"
                            >
                              <Edit2 size={13} />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Render Bunk Calc nested if open */}
                      {isBunkOpen && !isMarked && renderBunkCalculator(slot)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Note dialog popup */}
      {noteSlotId !== null && (
        <div className="fixed inset-0 bg-brand-bg/85 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in">
          <div className="max-w-md w-full bg-brand-card rounded-2xl border border-brand-border p-6 space-y-4 shadow-2xl">
            <h3 className="font-extrabold text-brand-text text-base flex items-center gap-1.5">
              <MessageSquare className="text-brand-primary" /> Edit Class Note
            </h3>
            <textarea
              className="w-full h-24 p-3 text-sm rounded-lg bg-brand-cardEl border border-brand-border text-brand-text focus:outline-none focus:border-brand-primary resize-none"
              placeholder="e.g. Surprise quiz, substitution lecture..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              maxLength={150}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setNoteSlotId(null)}
                className="py-1.5 px-3 rounded-lg bg-brand-cardEl border border-brand-border hover:bg-brand-border font-bold text-xs text-brand-textSec"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const slot = todaySlots.find((s) => s.id === noteSlotId);
                  if (slot) saveNote(slot);
                }}
                className="py-1.5 px-4 rounded-lg bg-brand-primary hover:bg-brand-primaryHover text-brand-text font-bold text-xs"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule override dialog modal */}
      {showRescheduleForm && (
        <div className="fixed inset-0 bg-brand-bg/85 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="max-w-md w-full bg-brand-card rounded-2xl border border-brand-border p-6 space-y-5 shadow-2xl">
            <div>
              <h3 className="font-black text-brand-text text-lg">
                {rescheduleType === 'add' ? 'Add Extra Class' : 'Override Class'}
              </h3>
              <p className="text-xs text-brand-textMuted mt-0.5 leading-relaxed">
                Applies a date-specific override. Weekly schedule remains unchanged.
              </p>
            </div>

            <div className="space-y-3.5">
              {/* Type toggle */}
              {rescheduleSlotId && (
                <div className="flex bg-brand-cardEl p-1 rounded-xl border border-brand-border mb-2">
                  <button
                    onClick={() => setRescheduleType('modify')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${
                      rescheduleType === 'modify' ? 'bg-brand-primary text-brand-text' : 'text-brand-textSec'
                    }`}
                  >
                    Modify Class
                  </button>
                  <button
                    onClick={() => setRescheduleType('delete')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${
                      rescheduleType === 'delete' ? 'bg-status-danger/10 border border-status-danger/30 text-status-danger' : 'text-brand-textSec'
                    }`}
                  >
                    Delete Class
                  </button>
                </div>
              )}

              {rescheduleType !== 'delete' && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-brand-textMuted uppercase mb-1">
                      Subject
                    </label>
                    <select
                      className="w-full px-3 py-2 text-sm rounded-lg bg-brand-cardEl border border-brand-border text-brand-text focus:outline-none"
                      value={rescheduleSubId}
                      onChange={(e) => setRescheduleSubId(e.target.value)}
                    >
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-brand-textMuted uppercase mb-1">
                        Period
                      </label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 text-sm rounded-lg bg-brand-cardEl border border-brand-border text-brand-text focus:outline-none"
                        value={reschedulePeriod}
                        onChange={(e) => setReschedulePeriod(Number(e.target.value))}
                        min="1"
                        max="12"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-brand-textMuted uppercase mb-1">
                        Start
                      </label>
                      <input
                        type="time"
                        className="w-full px-3 py-2 text-sm rounded-lg bg-brand-cardEl border border-brand-border text-brand-text focus:outline-none"
                        value={rescheduleStart}
                        onChange={(e) => setRescheduleStart(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-brand-textMuted uppercase mb-1">
                        End
                      </label>
                      <input
                        type="time"
                        className="w-full px-3 py-2 text-sm rounded-lg bg-brand-cardEl border border-brand-border text-brand-text focus:outline-none"
                        value={rescheduleEnd}
                        onChange={(e) => setRescheduleEnd(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              {rescheduleType === 'delete' && (
                <div className="p-3 bg-status-danger/10 border border-status-danger/25 text-status-danger rounded-xl text-xs font-semibold">
                  ⚠️ This standard class will be deleted/removed ONLY for this date ({activeDateStr}).
                </div>
              )}
            </div>

            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => setShowRescheduleForm(false)}
                className="py-2 px-4 rounded-lg bg-brand-cardEl border border-brand-border hover:bg-brand-border font-bold text-xs text-brand-textSec"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveReschedule}
                className="py-2 px-4 rounded-lg bg-brand-primary hover:bg-brand-primaryHover text-brand-text font-bold text-xs active:scale-95"
              >
                Save Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
