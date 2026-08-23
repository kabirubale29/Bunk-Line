import React, { useState } from 'react';
import { ArrowLeft, Archive, Calendar, Percent, ShieldCheck } from 'lucide-react';
import { calculateAttendance } from '../utils/calculations';

export default function PastSemestersView({ terms = [], onBack }) {
  const [selectedTerm, setSelectedTerm] = useState(null);

  const archivedTerms = terms.filter((t) => t.archived_at !== null);

  const handleSelectTerm = (term) => {
    setSelectedTerm(term);
  };

  const handleCloseDetail = () => {
    setSelectedTerm(null);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatArchivedTime = (timestamp) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Render detail view of a snapshot
  const renderDetail = () => {
    const snapshot = selectedTerm.snapshotData || {};
    const termSubjects = snapshot.subjects || [];
    const termRecords = snapshot.records || [];

    // Calculate details per subject
    const subjectStats = termSubjects.map((sub) => {
      const subRecords = termRecords.filter((r) => r.subject_id === sub.id);
      const present = subRecords.filter((r) => r.status === 'present').length;
      const absent = subRecords.filter((r) => r.status === 'absent').length;

      const calc = calculateAttendance({
        present,
        absent,
        baseline: {
          totalHeld: sub.baseline_total_held || 0,
          totalAttended: sub.baseline_total_attended || 0,
        },
        minAttendancePct: 60, // visual default
      });

      return {
        ...sub,
        present,
        absent,
        calc,
      };
    });

    // Calculate aggregate term statistics
    const totalPresent = subjectStats.reduce((acc, s) => acc + s.calc.presentCount, 0);
    const totalAbsent = subjectStats.reduce((acc, s) => acc + s.calc.absentCount, 0);
    const totalHeld = totalPresent + totalAbsent;
    const overallPct = totalHeld > 0 ? (totalPresent / totalHeld) * 100 : null;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between sticky top-0 bg-brand-bg/95 py-3 z-10 backdrop-blur-sm">
          <button
            onClick={handleCloseDetail}
            className="flex items-center gap-2 text-brand-textMuted hover:text-brand-text font-bold text-sm transition-colors py-2"
          >
            <ArrowLeft size={18} />
            <span>Back to Semesters</span>
          </button>
          <div className="w-12" /> {/* spacer */}
        </div>

        {/* Read only Warning Banner */}
        <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl text-status-warning text-sm flex items-center gap-2">
          <Archive size={18} className="shrink-0 animate-pulse" />
          <div className="font-semibold">
            Archived Term — Read-Only Mode. This data does not affect current stats.
          </div>
        </div>

        {/* Term summary */}
        <div className="bg-brand-card p-6 rounded-2xl border border-brand-border space-y-4">
          <div>
            <h3 className="text-2xl font-black text-brand-text">{selectedTerm.label}</h3>
            <p className="text-xs text-brand-textMuted font-bold uppercase tracking-wider mt-1">
              Started: {formatDate(selectedTerm.start_date)} &middot; Archived: {formatArchivedTime(selectedTerm.archived_at)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-brand-border">
            <div className="bg-brand-cardEl p-4 rounded-xl border border-brand-border">
              <span className="block text-[10px] font-bold text-brand-textMuted uppercase tracking-wider mb-1">
                Overall Attendance
              </span>
              <span className="text-3xl font-black text-brand-primary">
                {overallPct !== null ? `${overallPct.toFixed(1)}%` : '—'}
              </span>
            </div>
            <div className="bg-brand-cardEl p-4 rounded-xl border border-brand-border">
              <span className="block text-[10px] font-bold text-brand-textMuted uppercase tracking-wider mb-1">
                Total Classes
              </span>
              <span className="text-3xl font-black text-brand-text">
                {totalHeld} <span className="text-xs text-brand-textSec font-semibold">({totalPresent} present)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Subject cards list */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-brand-textSec uppercase tracking-wider">Subject Breakdown</h4>
          {subjectStats.length === 0 ? (
            <p className="text-brand-textMuted text-sm">No subjects were recorded in this semester.</p>
          ) : (
            subjectStats.map((sub) => (
              <div
                key={sub.id}
                className="bg-brand-card p-4 rounded-xl border border-brand-border flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                  <div>
                    <h5 className="font-extrabold text-brand-text text-base">{sub.name}</h5>
                    <p className="text-xs text-brand-textMuted font-semibold">
                      Held: {sub.calc.totalCount} &middot; Present: {sub.calc.presentCount} &middot; Absent: {sub.calc.absentCount}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xl font-black text-brand-text">
                    {sub.calc.pct !== null ? `${sub.calc.pct.toFixed(1)}%` : '—'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-24 md:py-8">
      {selectedTerm ? (
        renderDetail()
      ) : (
        <div className="space-y-6">
          {/* Main List Header */}
          <div className="flex items-center justify-between sticky top-0 bg-brand-bg/95 py-3 z-10 backdrop-blur-sm">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-brand-textMuted hover:text-brand-text font-bold text-sm transition-colors py-2"
            >
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
            <h2 className="text-xl font-extrabold text-brand-text">Past Semesters</h2>
            <div className="w-12" /> {/* spacer */}
          </div>

          {archivedTerms.length === 0 ? (
            <div className="text-center py-16 bg-brand-card rounded-2xl border border-brand-border">
              <Archive className="mx-auto text-brand-textMuted opacity-45 mb-3 animate-bounce" size={40} />
              <h3 className="font-bold text-brand-text">No archived semesters yet</h3>
              <p className="text-xs text-brand-textMuted mt-1 px-4">
                When you reset a semester under Setup, your current data will be archived here for read-only history.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {archivedTerms.map((term) => (
                <div
                  key={term.id}
                  onClick={() => handleSelectTerm(term)}
                  className="bg-brand-card p-5 rounded-xl border border-brand-border hover:border-brand-primary cursor-pointer transition-all flex items-center justify-between group active:scale-[0.99]"
                >
                  <div className="space-y-1">
                    <h3 className="font-black text-brand-text text-lg group-hover:text-brand-primary transition-colors">
                      {term.label}
                    </h3>
                    <p className="text-xs text-brand-textMuted font-semibold">
                      Started {formatDate(term.start_date)} &middot; Archived {formatArchivedTime(term.archived_at)}
                    </p>
                  </div>

                  <span className="text-brand-textMuted group-hover:text-brand-primary transition-colors shrink-0">
                    <ShieldCheck size={20} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
