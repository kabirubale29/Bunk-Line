import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Calendar, BookOpen, Clock, Archive, Download, Upload, Moon, Sun, Percent, Check, X, ShieldAlert } from 'lucide-react';

const PALETTE = [
  '#7C5CFF', // Purple
  '#38BDF8', // Cyan
  '#22C55E', // Green
  '#F59E0B', // Amber
  '#F97316', // Orange
  '#EC4899', // Pink
  '#A78BFA', // Lavender
  '#06B6D4', // Teal
];

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function SetupTab({
  subjects = [],
  scheduleSlots = [],
  terms = [],
  settings = {},
  onAddSubject,
  onUpdateSubject,
  onDeleteSubject,
  onAddSlot,
  onDeleteSlot,
  onUpdateSettings,
  onStartNewSemester,
  onViewPastSemesters,
  onImportData,
  onExportData,
}) {
  // Local state for UI forms
  const [activeSection, setActiveSection] = useState('subjects'); // 'subjects' | 'timetable' | 'semester' | 'danger'
  
  // Subject form states
  const [newSubName, setNewSubName] = useState('');
  const [editingSubId, setEditingSubId] = useState(null);
  const [editSubName, setEditSubName] = useState('');
  const [editSubColor, setEditSubColor] = useState('');
  const [editSubHeld, setEditSubHeld] = useState(0);
  const [editSubAttended, setEditSubAttended] = useState(0);

  // Slot form states
  const [slotDay, setSlotDay] = useState('Monday');
  const [slotSubId, setSlotSubId] = useState('');
  const [slotPeriod, setSlotPeriod] = useState(1);
  const [slotStart, setSlotStart] = useState('09:00');
  const [slotEnd, setSlotEnd] = useState('10:00');

  // Semester Reset form states
  const [newTermLabel, setNewTermLabel] = useState('');
  const [newTermStart, setNewTermStart] = useState(new Date().toISOString().split('T')[0]);
  const [carryForward, setCarryForward] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Subject Actions
  const handleCreateSubject = () => {
    if (!newSubName.trim()) return;
    const color = PALETTE[subjects.length % PALETTE.length];
    onAddSubject({
      name: newSubName.trim(),
      color,
      baseline_total_held: 0,
      baseline_total_attended: 0,
    });
    setNewSubName('');
  };

  const handleStartEditSubject = (sub) => {
    setEditingSubId(sub.id);
    setEditSubName(sub.name);
    setEditSubColor(sub.color);
    setEditSubHeld(sub.baseline_total_held);
    setEditSubAttended(sub.baseline_total_attended);
  };

  const handleSaveEditSubject = () => {
    if (!editSubName.trim()) return;
    onUpdateSubject(editingSubId, {
      name: editSubName.trim(),
      color: editSubColor,
      baseline_total_held: Number(editSubHeld),
      baseline_total_attended: Number(editSubAttended),
    });
    setEditingSubId(null);
  };

  // Slot Actions
  const handleCreateSlot = () => {
    if (!slotSubId) {
      alert('Please select a subject for the timetable slot.');
      return;
    }

    // Guard against duplicate slot on same weekday with same period or start_time
    const duplicate = scheduleSlots.find(
      (s) => s.weekday === slotDay && (s.start_time === slotStart || s.period === Number(slotPeriod))
    );
    if (duplicate) {
      const dupSub = subjects.find(sub => sub.id === duplicate.subject_id);
      alert(`Conflict: A class (${dupSub ? dupSub.name : 'Class'}) is already scheduled on ${slotDay} for Period ${duplicate.period} (${duplicate.start_time} - ${duplicate.end_time}). Please choose another period/time or edit the existing slot.`);
      return;
    }

    onAddSlot({
      subject_id: slotSubId,
      weekday: slotDay,
      period: Number(slotPeriod),
      start_time: slotStart,
      end_time: slotEnd,
    });
  };

  // Semester Reset
  const handleResetSemester = () => {
    if (!newTermLabel.trim()) {
      alert('Please enter a name for the new semester.');
      return;
    }
    onStartNewSemester({
      label: newTermLabel,
      startDate: newTermStart,
      carryForward,
    });
    setShowResetConfirm(false);
    setNewTermLabel('');
  };

  // Import JSON configuration file
  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (confirm('WARNING: Importing this backup will overwrite your current settings, subjects, timetable, and attendance records. Do you want to proceed?')) {
          onImportData(json);
        }
      } catch (err) {
        alert('Invalid JSON file format. Could not import backup.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-24 md:py-8 space-y-6">
      {/* Title */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-brand-text">Setup Panel</h2>
          <p className="text-xs text-brand-textMuted font-bold uppercase tracking-wider mt-1">
            Configure subjects, weekly timetable and preferences
          </p>
        </div>

        {/* Theme toggle & Export buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => onUpdateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
            className="p-2.5 rounded-xl bg-brand-card hover:bg-brand-cardEl text-brand-textSec hover:text-brand-text border border-brand-border transition-colors active:scale-95"
            title="Toggle theme"
          >
            {settings.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>

      {/* Internal Navigation Buttons */}
      <div className="flex flex-wrap gap-2 border-b border-brand-border pb-1">
        {[
          { id: 'subjects', label: 'Subjects & Baselines', icon: BookOpen },
          { id: 'timetable', label: 'Timetable slots', icon: Clock },
          { id: 'semester', label: 'Semester Reset', icon: Archive },
          { id: 'danger', label: 'Backup & Settings', icon: ShieldAlert },
        ].map((sec) => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all border ${
                isActive
                  ? 'bg-brand-primary text-brand-text border-brand-primary'
                  : 'bg-brand-card text-brand-textSec border-brand-border hover:bg-brand-cardEl hover:text-brand-text'
              }`}
            >
              <Icon size={14} />
              <span>{sec.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. Subjects Section */}
      {activeSection === 'subjects' && (
        <div className="space-y-6">
          {/* Add Subject box */}
          <div className="bg-brand-card p-5 rounded-2xl border border-brand-border space-y-4">
            <h3 className="text-sm font-extrabold text-brand-text uppercase tracking-wider">Add Subject</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Subject Name (e.g. Physics)"
                className="flex-1 px-4 py-3 rounded-lg bg-brand-cardEl border border-brand-border text-brand-text focus:outline-none focus:border-brand-primary transition-colors text-sm"
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSubject()}
              />
              <button
                onClick={handleCreateSubject}
                className="py-3 px-5 rounded-lg bg-brand-primary hover:bg-brand-primaryHover text-brand-text font-bold transition-all flex items-center justify-center gap-1 text-sm active:scale-95"
              >
                <Plus size={16} />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Subjects List */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-brand-textSec uppercase tracking-wider">Configure Subjects</h3>
            {subjects.length === 0 ? (
              <p className="text-brand-textMuted text-xs italic">No subjects configured yet.</p>
            ) : (
              <div className="space-y-3">
                {subjects.map((sub) => {
                  const isEditing = editingSubId === sub.id;
                  return (
                    <div
                      key={sub.id}
                      className="bg-brand-card p-4 rounded-xl border border-brand-border space-y-3 transition-all"
                    >
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-brand-textMuted uppercase mb-1">
                                Subject Name
                              </label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 rounded-lg bg-brand-cardEl border border-brand-border text-brand-text text-sm focus:outline-none focus:border-brand-primary"
                                value={editSubName}
                                onChange={(e) => setEditSubName(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-brand-textMuted uppercase mb-1">
                                Color
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  className="w-10 h-9 p-0.5 rounded-lg bg-brand-cardEl border border-brand-border cursor-pointer"
                                  value={editSubColor}
                                  onChange={(e) => setEditSubColor(e.target.value)}
                                />
                                <div className="flex-1 flex gap-1 flex-wrap">
                                  {PALETTE.map((c) => (
                                    <button
                                      key={c}
                                      onClick={() => setEditSubColor(c)}
                                      type="button"
                                      className="w-5 h-5 rounded-full border border-brand-border/40"
                                      style={{ backgroundColor: c }}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 p-3 bg-brand-cardEl/50 rounded-xl border border-brand-border border-dashed">
                            <div>
                              <label className="block text-[10px] font-bold text-brand-textMuted uppercase mb-1">
                                Lectures Held (Baseline)
                              </label>
                              <input
                                type="number"
                                className="w-full px-3 py-2 rounded-lg bg-brand-cardEl border border-brand-border text-brand-text text-sm focus:outline-none focus:border-brand-primary"
                                value={editSubHeld}
                                onChange={(e) => setEditSubHeld(e.target.value)}
                                min="0"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-brand-textMuted uppercase mb-1">
                                Lectures Attended (Baseline)
                              </label>
                              <input
                                type="number"
                                className="w-full px-3 py-2 rounded-lg bg-brand-cardEl border border-brand-border text-brand-text text-sm focus:outline-none focus:border-brand-primary"
                                value={editSubAttended}
                                onChange={(e) => setEditSubAttended(e.target.value)}
                                min="0"
                              />
                            </div>
                          </div>

                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setEditingSubId(null)}
                              className="py-1.5 px-3 rounded-lg bg-brand-cardEl hover:bg-brand-border border border-brand-border text-xs font-bold text-brand-textSec"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveEditSubject}
                              className="py-1.5 px-3 rounded-lg bg-brand-primary hover:bg-brand-primaryHover text-brand-text text-xs font-bold"
                            >
                              Save Changes
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3.5 h-3.5 rounded-full shrink-0"
                              style={{ backgroundColor: sub.color }}
                            />
                            <div>
                              <h4 className="font-extrabold text-brand-text text-base leading-tight">
                                {sub.name}
                              </h4>
                              <p className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider mt-0.5">
                                Baseline: {sub.baseline_total_attended}/{sub.baseline_total_held} held
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleStartEditSubject(sub)}
                              className="p-2 rounded-lg bg-brand-cardEl hover:bg-brand-border text-brand-textMuted hover:text-brand-text transition-colors"
                              title="Edit Subject"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete ${sub.name}? This will remove its timetable slots and attendance logs permanently.`)) {
                                  onDeleteSubject(sub.id);
                                }
                              }}
                              className="p-2 rounded-lg bg-brand-cardEl hover:bg-brand-border text-brand-textMuted hover:text-status-danger transition-colors"
                              title="Delete Subject"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Timetable Section */}
      {activeSection === 'timetable' && (
        <div className="space-y-6">
          {/* Add Slot box */}
          <div className="bg-brand-card p-5 rounded-2xl border border-brand-border space-y-4">
            <h3 className="text-sm font-extrabold text-brand-text uppercase tracking-wider">Add Schedule Slot</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-brand-textMuted uppercase mb-1">
                  Day of Week
                </label>
                <select
                  className="w-full px-3 py-2 text-sm rounded-lg bg-brand-cardEl border border-brand-border text-brand-text focus:outline-none"
                  value={slotDay}
                  onChange={(e) => setSlotDay(e.target.value)}
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-brand-textMuted uppercase mb-1">
                  Subject
                </label>
                <select
                  className="w-full px-3 py-2 text-sm rounded-lg bg-brand-cardEl border border-brand-border text-brand-text focus:outline-none"
                  value={slotSubId}
                  onChange={(e) => setSlotSubId(e.target.value)}
                >
                  <option value="">Select subject</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-brand-textMuted uppercase mb-1">
                  Period / Order
                </label>
                <input
                  type="number"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-brand-cardEl border border-brand-border text-brand-text focus:outline-none"
                  value={slotPeriod}
                  onChange={(e) => setSlotPeriod(e.target.value)}
                  min="1"
                  max="12"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-brand-textMuted uppercase mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-brand-cardEl border border-brand-border text-brand-text focus:outline-none"
                  value={slotStart}
                  onChange={(e) => setSlotStart(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-brand-textMuted uppercase mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-brand-cardEl border border-brand-border text-brand-text focus:outline-none"
                  value={slotEnd}
                  onChange={(e) => setSlotEnd(e.target.value)}
                />
              </div>
            </div>

            <button
              onClick={handleCreateSlot}
              className="w-full py-2.5 px-4 rounded-lg bg-brand-primary hover:bg-brand-primaryHover text-brand-text font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
            >
              <Plus size={14} />
              <span>Add Timetable Slot</span>
            </button>
          </div>

          {/* Timetable Slots Display */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-brand-textSec uppercase tracking-wider">Timetable Timelines</h3>
            {WEEKDAYS.map((day) => {
              const daySlots = scheduleSlots
                .filter((slot) => slot.weekday === day)
                // Sort by time
                .sort((a, b) => a.start_time.localeCompare(b.start_time));

              if (daySlots.length === 0) return null;

              return (
                <div key={day} className="bg-brand-card p-4 rounded-xl border border-brand-border space-y-3">
                  <h4 className="font-extrabold text-brand-primary text-sm tracking-wider uppercase border-b border-brand-border/60 pb-1">
                    {day}
                  </h4>
                  <div className="space-y-2">
                    {daySlots.map((slot) => {
                      const sub = subjects.find((s) => s.id === slot.subject_id);
                      return (
                        <div
                          key={slot.id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-brand-cardEl border border-brand-border/60 text-xs font-semibold"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: sub?.color || '#9299A8' }}
                            />
                            <div>
                              <span className="font-bold text-brand-text">{sub?.name || 'Deleted subject'}</span>
                              <span className="text-brand-textMuted mx-1.5">&middot;</span>
                              <span className="text-brand-textSec">
                                Period {slot.period} ({slot.start_time} – {slot.end_time})
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => onDeleteSlot(slot.id)}
                            className="text-brand-textMuted hover:text-status-danger transition-colors p-1"
                            title="Remove slot"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Semester Section */}
      {activeSection === 'semester' && (
        <div className="space-y-6">
          {/* Active terms review & history */}
          <div className="bg-brand-card p-5 rounded-2xl border border-brand-border space-y-4">
            <h3 className="text-sm font-extrabold text-brand-text uppercase tracking-wider">Archive & Reset</h3>
            <p className="text-xs text-brand-textSec leading-relaxed">
              When a semester finishes, click below to freeze its logs as read-only and start fresh. You can copy subjects and timetable to the next term.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onViewPastSemesters}
                className="py-2.5 px-4 rounded-xl bg-brand-cardEl hover:bg-brand-border border border-brand-border text-brand-text font-bold text-xs flex items-center gap-2 transition-all"
              >
                <Archive size={14} />
                <span>View Past Semesters</span>
              </button>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="py-2.5 px-4 rounded-xl bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/25 text-status-danger font-bold text-xs flex items-center gap-2 transition-all active:scale-95"
              >
                <Archive size={14} />
                <span>Start New Semester</span>
              </button>
            </div>
          </div>

          {/* Reset Modal Overlay dialog */}
          {showResetConfirm && (
            <div className="fixed inset-0 bg-brand-bg/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="max-w-md w-full bg-brand-card rounded-2xl border border-brand-border p-6 space-y-6 shadow-2xl">
                <div>
                  <h3 className="text-lg font-black text-brand-text flex items-center gap-2">
                    <ShieldAlert className="text-status-danger" /> Confirm Semester Reset
                  </h3>
                  <p className="text-xs text-brand-textSec mt-1 leading-relaxed">
                    This will freeze all attendance logs for the current term and start a new active semester.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-brand-textMuted uppercase mb-1">
                      New Semester Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 rounded-lg bg-brand-cardEl border border-brand-border text-brand-text text-sm focus:outline-none focus:border-brand-primary"
                      placeholder="e.g. Sem 4, 2026"
                      value={newTermLabel}
                      onChange={(e) => setNewTermLabel(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-brand-textMuted uppercase mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 rounded-lg bg-brand-cardEl border border-brand-border text-brand-text text-sm focus:outline-none focus:border-brand-primary"
                      value={newTermStart}
                      onChange={(e) => setNewTermStart(e.target.value)}
                    />
                  </div>

                  <label className="flex items-center gap-2.5 p-3.5 bg-brand-cardEl border border-brand-border rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded accent-brand-primary w-4 h-4 cursor-pointer"
                      checked={carryForward}
                      onChange={(e) => setCarryForward(e.target.checked)}
                    />
                    <div className="text-xs">
                      <span className="font-bold text-brand-text block">Copy Subjects & Schedule</span>
                      <span className="text-[10px] text-brand-textMuted leading-none block">
                        Keeps subjects and timetable but resets baseline counts to 0.
                      </span>
                    </div>
                  </label>
                </div>

                <div className="flex gap-2.5 justify-end">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="py-2 px-4 rounded-lg bg-brand-cardEl border border-brand-border hover:bg-brand-border font-bold text-xs text-brand-textSec"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResetSemester}
                    className="py-2 px-4 rounded-lg bg-status-danger text-brand-text font-bold text-xs active:scale-95 transition-all"
                  >
                    Confirm & Start
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Backup & Settings Section */}
      {activeSection === 'danger' && (
        <div className="space-y-6">
          <div className="bg-brand-card p-5 rounded-2xl border border-brand-border space-y-4">
            <h3 className="text-sm font-extrabold text-brand-text uppercase tracking-wider">Export / Import Backup</h3>
            <p className="text-xs text-brand-textSec leading-relaxed">
              Manually download a JSON file containing all settings, subjects, timetable history, notes, and attendance overrides, or restore from a past JSON file.
            </p>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={onExportData}
                className="py-2.5 px-4 rounded-xl bg-brand-cardEl hover:bg-brand-border border border-brand-border text-brand-text font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <Download size={14} />
                <span>Export JSON File</span>
              </button>

              <label className="py-2.5 px-4 rounded-xl bg-brand-cardEl hover:bg-brand-border border border-brand-border text-brand-text font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer">
                <Upload size={14} />
                <span>Import JSON File</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportFile}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
