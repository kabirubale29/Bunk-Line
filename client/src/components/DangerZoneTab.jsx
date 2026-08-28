import React, { useState } from 'react';
import { Flame, AlertTriangle, ShieldCheck, History, Info, Sparkles, ChevronRight, HelpCircle } from 'lucide-react';
import { calculateAttendance, getZoneColor, calculateStreak, simulateWhatIf } from '../utils/calculations';

export default function DangerZoneTab({
  subjects = [],
  records = [],
  settings = {},
  onUpdateSettings,
  onViewHistory,
}) {
  const [whatIfConfig, setWhatIfConfig] = useState({}); // Stores simulator settings per subject id: { action: 'skip' | 'attend', count: number }
  
  const minAttendancePct = settings.minAttendancePct || 60;

  // 1. Calculate stats per subject
  const subjectStats = subjects.map((sub) => {
    const subRecords = records.filter((r) => r.subject_id === sub.id);
    const present = subRecords.filter((r) => r.status === 'present').length;
    const absent = subRecords.filter((r) => r.status === 'absent').length;

    const calc = calculateAttendance({
      present,
      absent,
      baseline: {
        totalHeld: sub.baseline_total_held || 0,
        totalAttended: sub.baseline_total_attended || 0,
      },
      minAttendancePct,
    });

    const streak = calculateStreak(subRecords);

    return {
      ...sub,
      present,
      absent,
      calc,
      streak,
    };
  });

  // Sort: worst-percentage-first (ascending order of calc.pct, nulls treated as 100% or last)
  subjectStats.sort((a, b) => {
    const pctA = a.calc.pct === null ? 101 : a.calc.pct;
    const pctB = b.calc.pct === null ? 101 : b.calc.pct;
    return pctA - pctB;
  });

  // Calculate Overall Statistics across all non-archived subjects
  const activeStats = subjectStats.filter((s) => !s.archived);
  const overallPresent = activeStats.reduce((acc, s) => acc + s.calc.presentCount, 0);
  const overallAbsent = activeStats.reduce((acc, s) => acc + s.calc.absentCount, 0);
  const overallHeld = overallPresent + overallAbsent;
  const overallPct = overallHeld > 0 ? (overallPresent / overallHeld) * 100 : null;

  const overallColor = getZoneColor(overallPct, minAttendancePct);

  // Selector functions for what-if scenarios
  const handleWhatIfActionChange = (subId, action) => {
    setWhatIfConfig((prev) => ({
      ...prev,
      [subId]: {
        ...prev[subId],
        action,
        count: prev[subId]?.count || 1,
      },
    }));
  };

  const handleWhatIfCountChange = (subId, count) => {
    setWhatIfConfig((prev) => ({
      ...prev,
      [subId]: {
        ...prev[subId],
        count: Math.max(1, count),
      },
    }));
  };

  const resetWhatIf = (subId) => {
    setWhatIfConfig((prev) => {
      const copy = { ...prev };
      delete copy[subId];
      return copy;
    });
  };

  // SVG circular progress gauge helper
  const renderCircleGauge = (pct, size = 64, strokeWidth = 6, color = '#7C5CFF') => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const percentage = pct === null ? 0 : Math.min(100, Math.max(0, pct));
    const offset = circumference - (percentage / 100) * circumference;

    return (
      <svg width={size} height={size} className="rotate-[-90deg]">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="var(--border-color)"
          strokeWidth={strokeWidth}
        />
        {/* Foreground fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-24 md:py-8 space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-black tracking-tight text-brand-text">Danger Zone</h2>
        <p className="text-xs text-brand-textMuted font-bold uppercase tracking-wider mt-1">
          Monitor threshold risk and play scenarios
        </p>
      </div>

      {/* Threshold Setting inline */}
      <div className="bg-brand-card p-4 rounded-xl border border-brand-border flex items-center justify-between gap-4 shadow-warm">
        <div className="flex items-center gap-2 text-xs font-bold text-brand-textSec uppercase tracking-wider">
          <PercentInput
            value={minAttendancePct}
            onChange={(val) => onUpdateSettings({ minAttendancePct: val })}
          />
        </div>
        <div className="text-[10px] text-brand-textMuted max-w-[200px] text-right font-semibold">
          Min threshold target for course eligibility.
        </div>
      </div>

      {/* Overall Summary Card */}
      <div className="bg-brand-card p-6 rounded-2xl border border-brand-border flex items-center justify-between gap-4 relative overflow-hidden shadow-warm">
        {/* Subtle background glow based on overall status */}
        <div
          className="absolute right-0 top-0 w-32 h-32 blur-3xl opacity-10 rounded-full pointer-events-none"
          style={{ backgroundColor: overallColor }}
        />

        <div className="space-y-2">
          <h3 className="text-xs font-bold text-brand-textMuted uppercase tracking-widest">Overall Average</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-brand-text">
              {overallPct !== null ? `${overallPct.toFixed(1)}%` : '—'}
            </span>
          </div>
          <p className="text-xs text-brand-textSec font-bold">
            Held: <span className="text-brand-text">{overallHeld}</span> &middot; Present:{' '}
            <span className="text-status-safe">{overallPresent}</span> &middot; Absent:{' '}
            <span className="text-status-danger">{overallAbsent}</span>
          </p>
        </div>

        <div className="shrink-0 relative flex items-center justify-center">
          {renderCircleGauge(overallPct, 80, 8, overallColor)}
          <div className="absolute font-black text-xs" style={{ color: overallColor }}>
            {overallPct !== null ? `${Math.round(overallPct)}%` : '—'}
          </div>
        </div>
      </div>

      {/* Subject List */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-brand-textSec uppercase tracking-wider">Subject Risk Ratings</h3>
        
        {subjectStats.length === 0 ? (
          <div className="text-center py-12 bg-brand-card rounded-xl border border-brand-border">
            <Info className="mx-auto text-brand-textMuted mb-2 opacity-50" size={32} />
            <p className="text-brand-textSec text-sm font-semibold">No subjects available</p>
            <p className="text-xs text-brand-textMuted mt-1">Configure subjects in the Setup tab first.</p>
          </div>
        ) : (
          subjectStats.map((sub) => {
            const hasSim = !!whatIfConfig[sub.id];
            const sim = whatIfConfig[sub.id] || { action: 'skip', count: 1 };

            // Real statistics
            const realCalc = sub.calc;
            const subColor = getZoneColor(realCalc.pct, minAttendancePct);

            // Simulated statistics (if configured)
            const simCalc = hasSim
              ? simulateWhatIf({
                  present: sub.present,
                  absent: sub.absent,
                  baseline: {
                    totalHeld: sub.baseline_total_held || 0,
                    totalAttended: sub.baseline_total_attended || 0,
                  },
                  minAttendancePct,
                  action: sim.action,
                  count: sim.count,
                })
              : null;

            const displayCalc = hasSim ? simCalc : realCalc;
            const displayColor = hasSim ? getZoneColor(simCalc.pct, minAttendancePct) : subColor;

            return (
              <div
                key={sub.id}
                className={`bg-brand-card rounded-2xl border transition-all p-5 space-y-4 shadow-warm ${
                  hasSim ? 'border-brand-primary ring-1 ring-brand-primary/20' : 'border-brand-border'
                }`}
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: sub.color }}
                      />
                      <h4 className="font-extrabold text-brand-text text-base leading-tight">
                        {sub.name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-semibold text-brand-textMuted">
                      <span>Streak: {sub.streak > 0 ? `🔥 ${sub.streak}-class` : 'none'}</span>
                      <button
                        onClick={() => onViewHistory(sub.id)}
                        className="text-brand-primary hover:underline flex items-center gap-1 font-bold text-[10px] uppercase tracking-wider py-1"
                      >
                        <History size={12} /> History
                      </button>
                    </div>
                  </div>

                  {/* Percentage Indicator */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      {hasSim && (
                        <div className="text-[9px] font-bold text-brand-primary uppercase tracking-widest leading-none mb-0.5">
                          Hypothetical
                        </div>
                      )}
                      <div className="text-2xl font-black text-brand-text">
                        {displayCalc.pct !== null ? `${displayCalc.pct.toFixed(1)}%` : '—'}
                      </div>
                    </div>
                    {renderCircleGauge(displayCalc.pct, 44, 4, displayColor)}
                  </div>
                </div>

                {/* Subject Breakdown Stats Grid */}
                <div className="grid grid-cols-4 gap-2 text-center my-1">
                  <div className="bg-brand-cardEl/70 p-2.5 rounded-xl border border-brand-border/50">
                    <div className="text-[9px] font-extrabold text-brand-textMuted uppercase tracking-wider">Total Held</div>
                    <div className="font-black text-sm text-brand-text mt-0.5">{displayCalc.totalHeld ?? displayCalc.totalCount ?? 0}</div>
                  </div>
                  <div className="bg-brand-cardEl/70 p-2.5 rounded-xl border border-brand-border/50">
                    <div className="text-[9px] font-extrabold text-status-safe uppercase tracking-wider">Attended</div>
                    <div className="font-black text-sm text-status-safe mt-0.5">{displayCalc.presentCount ?? 0}</div>
                  </div>
                  <div className="bg-brand-cardEl/70 p-2.5 rounded-xl border border-brand-border/50">
                    <div className="text-[9px] font-extrabold text-status-danger uppercase tracking-wider">Bunked</div>
                    <div className="font-black text-sm text-status-danger mt-0.5">{displayCalc.absentCount ?? 0}</div>
                  </div>
                  <div className="bg-brand-cardEl/70 p-2.5 rounded-xl border border-brand-border/50">
                    <div className="text-[9px] font-extrabold text-brand-primary uppercase tracking-wider">Bunk Margin</div>
                    <div className="font-black text-xs text-brand-text mt-1">
                      {(displayCalc.safeBunks ?? displayCalc.safeToSkip) > 0 
                        ? `+${displayCalc.safeBunks ?? displayCalc.safeToSkip} bunks` 
                        : displayCalc.mustAttend > 0 
                        ? `-${displayCalc.mustAttend} attend` 
                        : 'On target'}
                    </div>
                  </div>
                </div>

                {/* Verdict Guideline */}
                <div
                  className="p-3.5 rounded-xl text-xs font-bold border flex items-start gap-2"
                  style={{
                    backgroundColor: `${displayColor}0a`,
                    borderColor: `${displayColor}20`,
                    color: displayColor,
                  }}
                >
                  {displayCalc.status === 'SAFE' && (
                    <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                  )}
                  {displayCalc.status === 'BORDERLINE' && (
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  )}
                  {displayCalc.status === 'DANGER' && (
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  )}
                  <span>{displayCalc.verdict}</span>
                </div>

                {/* What-If Simulator Drawer */}
                <div className="pt-3 border-t border-brand-border/60">
                  {!hasSim ? (
                    <button
                      onClick={() => handleWhatIfActionChange(sub.id, 'skip')}
                      className="w-full py-2.5 px-4 rounded-xl bg-brand-cardEl hover:bg-brand-border text-brand-textSec hover:text-brand-text font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-brand-border/40"
                    >
                      <Sparkles size={14} className="text-brand-primary" />
                      <span>Should I Bunk This?</span>
                    </button>
                  ) : (
                    <div className="bg-brand-cardEl p-3 rounded-xl border border-brand-border space-y-3">
                      <div className="flex items-center justify-between text-xs pb-1 border-b border-brand-border/50">
                        <button
                          onClick={() => resetWhatIf(sub.id)}
                          className="font-bold text-brand-text flex items-center gap-1.5 hover:underline"
                        >
                          <Sparkles size={12} className="text-brand-primary animate-pulse" />
                          <span>Should I Bunk This? (Simulator)</span>
                        </button>
                        <button
                          onClick={() => resetWhatIf(sub.id)}
                          className="text-[10px] font-bold text-brand-textMuted hover:text-brand-text uppercase bg-brand-card px-2 py-0.5 rounded border border-brand-border transition-colors"
                        >
                          Close ✕
                        </button>
                      </div>

                      {/* Action selector */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleWhatIfActionChange(sub.id, 'skip')}
                          className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all border ${
                            sim.action === 'skip'
                              ? 'bg-status-danger/10 text-status-danger border-status-danger/25'
                              : 'bg-brand-card text-brand-textSec border-brand-border'
                          }`}
                        >
                          Bunk Next Classes
                        </button>
                        <button
                          onClick={() => handleWhatIfActionChange(sub.id, 'attend')}
                          className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all border ${
                            sim.action === 'attend'
                              ? 'bg-status-safe/10 text-status-safe border-status-safe/25'
                              : 'bg-brand-card text-brand-textSec border-brand-border'
                          }`}
                        >
                          Attend Next Classes
                        </button>
                      </div>

                      {/* Count incrementor */}
                      <div className="flex items-center justify-between gap-4 pt-1">
                        <span className="text-[11px] font-bold text-brand-textMuted uppercase">
                          How many classes:
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleWhatIfCountChange(sub.id, sim.count - 1)}
                            className="w-7 h-7 rounded-lg bg-brand-card border border-brand-border flex items-center justify-center font-bold hover:bg-brand-cardEl"
                          >
                            -
                          </button>
                          <span className="font-extrabold text-sm text-brand-text min-w-[20px] text-center">
                            {sim.count}
                          </span>
                          <button
                            onClick={() => handleWhatIfCountChange(sub.id, sim.count + 1)}
                            className="w-7 h-7 rounded-lg bg-brand-card border border-brand-border flex items-center justify-center font-bold hover:bg-brand-cardEl"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Inline input for settings percentages
function PercentInput({ value, onChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempVal, setTempVal] = useState(value);

  const handleSave = () => {
    setIsEditing(false);
    const num = Number(tempVal);
    if (!isNaN(num) && num >= 1 && num <= 99) {
      onChange(num);
    } else {
      setTempVal(value);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-bold text-brand-text">Target:</span>
        <input
          type="number"
          className="w-14 px-2 py-1 rounded bg-brand-cardEl border border-brand-primary text-brand-text text-center text-xs font-bold focus:outline-none"
          value={tempVal}
          onChange={(e) => setTempVal(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          autoFocus
          min="10"
          max="99"
        />
        <span className="font-bold text-brand-text">%</span>
      </div>
    );
  }

  return (
    <div
      onClick={() => {
        setTempVal(value);
        setIsEditing(true);
      }}
      className="cursor-pointer hover:bg-brand-cardEl px-2.5 py-1.5 rounded-lg border border-brand-border/40 transition-colors flex items-center gap-1.5 active:scale-95"
    >
      <span className="font-bold text-brand-textSec">Target Threshold:</span>
      <span className="font-extrabold text-brand-primary text-sm hover:underline">{value}%</span>
    </div>
  );
}
