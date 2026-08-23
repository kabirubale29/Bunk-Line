import React, { useState } from 'react';
import { Plus, Trash2, Calendar, BookOpen, Percent, Clock, ArrowRight, ArrowLeft, Check } from 'lucide-react';

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

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [termName, setTermName] = useState('Sem 1, 2026');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [subjects, setSubjects] = useState([]);
  const [newSubName, setNewSubName] = useState('');
  const [minPct, setMinPct] = useState(60);

  // Helper to add subject
  const handleAddSubject = () => {
    if (!newSubName.trim()) return;
    const color = PALETTE[subjects.length % PALETTE.length];
    setSubjects([
      ...subjects,
      {
        id: Math.random().toString(36).substring(2, 9),
        name: newSubName.trim(),
        color,
        baseline_total_held: 0,
        baseline_total_attended: 0,
      },
    ]);
    setNewSubName('');
  };

  // Helper to remove subject
  const handleRemoveSubject = (id) => {
    setSubjects(subjects.filter((s) => s.id !== id));
  };

  // Move to next step
  const nextStep = () => {
    if (step === 1 && !termName.trim()) return;
    if (step === 2 && subjects.length === 0) {
      alert('Please add at least one subject.');
      return;
    }
    setStep(step + 1);
  };

  // Move to previous step
  const prevStep = () => {
    setStep(step - 1);
  };

  // Finish setup
  const handleFinish = () => {
    onComplete({
      term: {
        label: termName,
        startDate: startDate,
      },
      subjects,
      settings: {
        minAttendancePct: Number(minPct),
      },
    });
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-brand-card rounded-2xl border border-brand-border shadow-xl p-6 relative overflow-hidden">
        {/* Progress header */}
        <div className="flex items-center justify-between mb-8">
          <span className="text-xs font-bold text-brand-textMuted tracking-wider uppercase">
            Step {step} of 3
          </span>
          <div className="flex gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 w-8 rounded-full transition-all duration-300 ${
                  s <= step ? 'bg-brand-primary' : 'bg-brand-border'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Semester details */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-extrabold text-brand-text flex items-center gap-2">
                <Calendar className="text-brand-primary" /> Create Semester
              </h2>
              <p className="text-sm text-brand-textSec mt-1">
                Name your current term/semester and set its starting date.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-brand-textSec uppercase tracking-wider mb-2">
                  Semester Label
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-lg bg-brand-cardEl border border-brand-border text-brand-text focus:outline-none focus:border-brand-primary transition-colors text-base"
                  value={termName}
                  onChange={(e) => setTermName(e.target.value)}
                  placeholder="e.g. Sem 3, 2026"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-textSec uppercase tracking-wider mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  className="w-full px-4 py-3 rounded-lg bg-brand-cardEl border border-brand-border text-brand-text focus:outline-none focus:border-brand-primary transition-colors text-base"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>

            <button
              onClick={nextStep}
              className="w-full mt-4 py-3 px-4 rounded-lg bg-brand-primary hover:bg-brand-primaryHover text-brand-text font-bold flex items-center justify-center gap-2 transition-all text-base active:scale-[0.98]"
            >
              <span>Continue</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Step 2: Add Subjects */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-extrabold text-brand-text flex items-center gap-2">
                <BookOpen className="text-brand-primary" /> Add Subjects
              </h2>
              <p className="text-sm text-brand-textSec mt-1">
                Add the subjects you are taking this semester.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-4 py-3 rounded-lg bg-brand-cardEl border border-brand-border text-brand-text focus:outline-none focus:border-brand-primary transition-colors text-base"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSubject()}
                  placeholder="Subject Name (e.g. Physics)"
                />
                <button
                  onClick={handleAddSubject}
                  className="p-3 rounded-lg bg-brand-primary hover:bg-brand-primaryHover text-brand-text transition-colors flex items-center justify-center"
                >
                  <Plus size={20} />
                </button>
              </div>

              {subjects.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {subjects.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-brand-cardEl border border-brand-border"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-3.5 h-3.5 rounded-full shadow-sm"
                          style={{ backgroundColor: sub.color }}
                        />
                        <span className="font-semibold text-brand-text text-sm">{sub.name}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveSubject(sub.id)}
                        className="text-brand-textMuted hover:text-status-danger transition-colors p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={prevStep}
                className="flex-1 py-3 px-4 rounded-lg bg-brand-cardEl hover:bg-brand-border text-brand-text font-bold flex items-center justify-center gap-2 transition-all border border-brand-border text-sm"
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
              <button
                onClick={nextStep}
                className="flex-1 py-3 px-4 rounded-lg bg-brand-primary hover:bg-brand-primaryHover text-brand-text font-bold flex items-center justify-center gap-2 transition-all text-sm active:scale-[0.98]"
              >
                <span>Continue</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Set Minimum Attendance */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-extrabold text-brand-text flex items-center gap-2">
                <Percent className="text-brand-primary" /> Min Attendance
              </h2>
              <p className="text-sm text-brand-textSec mt-1">
                Choose the required percentage threshold before you are in danger of detention.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between bg-brand-cardEl p-4 rounded-xl border border-brand-border">
                <span className="font-bold text-4xl text-brand-primary">{minPct}%</span>
                <input
                  type="range"
                  min="40"
                  max="90"
                  step="5"
                  className="w-1/2 accent-brand-primary cursor-pointer"
                  value={minPct}
                  onChange={(e) => setMinPct(e.target.value)}
                />
              </div>

              <div className="text-xs text-brand-textMuted bg-brand-cardEl/50 p-3 rounded-lg border border-brand-border border-dashed">
                💡 Default is 60%. You can change this setting at any time on the Danger Zone or Setup page.
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={prevStep}
                className="flex-1 py-3 px-4 rounded-lg bg-brand-cardEl hover:bg-brand-border text-brand-text font-bold flex items-center justify-center gap-2 transition-all border border-brand-border text-sm"
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
              <button
                onClick={handleFinish}
                className="flex-1 py-3 px-4 rounded-lg bg-brand-primary hover:bg-brand-primaryHover text-brand-text font-bold flex items-center justify-center gap-2 transition-all text-sm active:scale-[0.98]"
              >
                <Check size={16} />
                <span>Finish Setup</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
