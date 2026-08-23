import React, { useState } from 'react';
import { Calendar, BarChart, Award, TrendingUp, Info } from 'lucide-react';

export default function StatsTab({ records = [], subjects = [] }) {
  const [granularity, setGranularity] = useState('week'); // 'week' | 'month'

  const subjectMap = subjects.reduce((acc, sub) => {
    acc[sub.id] = sub;
    return acc;
  }, {});

  // Date helper functions
  const getStartOfWeek = (d, offsetWeeks = 0) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1) + (offsetWeeks * 7);
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const getEndOfWeek = (monday) => {
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return sunday;
  };

  const getStartOfMonth = (d, offsetMonths = 0) => {
    const date = new Date(d.getFullYear(), d.getMonth() + offsetMonths, 1);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const getEndOfMonth = (startOfMonth) => {
    const end = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return end;
  };

  // Compute ranges
  const now = new Date();
  const thisWeekStart = getStartOfWeek(now, 0);
  const thisWeekEnd = getEndOfWeek(thisWeekStart);
  const lastWeekStart = getStartOfWeek(now, -1);
  const lastWeekEnd = getEndOfWeek(lastWeekStart);

  const thisMonthStart = getStartOfMonth(now, 0);
  const thisMonthEnd = getEndOfMonth(thisMonthStart);
  const lastMonthStart = getStartOfMonth(now, -1);
  const lastMonthEnd = getEndOfMonth(lastMonthStart);

  // Helper to aggregate records in a date range
  const aggregateRange = (start, end) => {
    const inRange = records.filter((r) => {
      const recDate = new Date(r.date + 'T00:00:00');
      return recDate >= start && recDate <= end;
    });

    const present = inRange.filter((r) => r.status === 'present').length;
    const absent = inRange.filter((r) => r.status === 'absent').length;
    const total = present + absent;
    const pct = total > 0 ? (present / total) * 100 : null;

    // Group by subject
    const bySubject = {};
    subjects.forEach((sub) => {
      const subRecs = inRange.filter((r) => r.subject_id === sub.id);
      const subPresent = subRecs.filter((r) => r.status === 'present').length;
      const subAbsent = subRecs.filter((r) => r.status === 'absent').length;
      const subTotal = subPresent + subAbsent;
      bySubject[sub.id] = {
        present: subPresent,
        absent: subAbsent,
        total: subTotal,
        pct: subTotal > 0 ? (subPresent / subTotal) * 100 : null,
      };
    });

    return { present, absent, total, pct, bySubject };
  };

  // Aggregate values
  const thisWeekData = aggregateRange(thisWeekStart, thisWeekEnd);
  const lastWeekData = aggregateRange(lastWeekStart, lastWeekEnd);
  const thisMonthData = aggregateRange(thisMonthStart, thisMonthEnd);
  const lastMonthData = aggregateRange(lastMonthStart, lastMonthEnd);

  const currentData = granularity === 'week' ? thisWeekData : thisMonthData;
  const previousData = granularity === 'week' ? lastWeekData : lastMonthData;

  const currentLabel = granularity === 'week' ? 'This Week' : 'This Month';
  const previousLabel = granularity === 'week' ? 'Last Week' : 'Last Month';

  const rangeText = granularity === 'week'
    ? `${thisWeekStart.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${thisWeekEnd.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
    : thisMonthStart.toLocaleDateString([], { month: 'long', year: 'numeric' });

  // Custom visual components
  const renderComparisonBar = (currVal, prevVal, title, suffix = '') => {
    const maxVal = Math.max(currVal, prevVal, 1);
    const currPct = (currVal / maxVal) * 100;
    const prevPct = (prevVal / maxVal) * 100;

    return (
      <div className="space-y-3 bg-brand-card p-5 rounded-2xl border border-brand-border">
        <h4 className="text-xs font-bold text-brand-textMuted uppercase tracking-wider">{title}</h4>
        <div className="space-y-4">
          {/* Current Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-brand-text">{currentLabel}</span>
              <span className="font-extrabold text-brand-primary">{currVal.toFixed(0)}{suffix}</span>
            </div>
            <div className="h-3 w-full bg-brand-cardEl rounded-full overflow-hidden border border-brand-border/40">
              <div
                className="h-full bg-brand-primary rounded-full transition-all duration-500"
                style={{ width: `${currPct}%` }}
              />
            </div>
          </div>

          {/* Previous Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-brand-textSec">{previousLabel}</span>
              <span className="font-bold text-brand-textMuted">{prevVal.toFixed(0)}{suffix}</span>
            </div>
            <div className="h-3 w-full bg-brand-cardEl rounded-full overflow-hidden border border-brand-border/40">
              <div
                className="h-full bg-brand-textMuted rounded-full transition-all duration-500 opacity-60"
                style={{ width: `${prevPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-24 md:py-8 space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-black tracking-tight text-brand-text">Statistics</h2>
        <p className="text-xs text-brand-textMuted font-bold uppercase tracking-wider mt-1">
          Compare attendance intervals
        </p>
      </div>

      {/* Selector tab buttons */}
      <div className="flex bg-brand-card p-1.5 rounded-xl border border-brand-border">
        <button
          onClick={() => setGranularity('week')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            granularity === 'week'
              ? 'bg-brand-primary text-brand-text shadow'
              : 'text-brand-textSec hover:text-brand-text'
          }`}
        >
          Weekly Comparison
        </button>
        <button
          onClick={() => setGranularity('month')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            granularity === 'month'
              ? 'bg-brand-primary text-brand-text shadow'
              : 'text-brand-textSec hover:text-brand-text'
          }`}
        >
          Monthly Comparison
        </button>
      </div>

      {/* Date interval label */}
      <div className="text-center bg-brand-cardEl py-2.5 px-4 rounded-xl border border-brand-border border-dashed flex items-center justify-center gap-2 text-xs font-bold text-brand-textSec">
        <Calendar size={14} className="text-brand-primary" />
        <span>Current Period: {rangeText}</span>
      </div>

      {/* Metrics comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderComparisonBar(
          currentData.pct !== null ? currentData.pct : 0,
          previousData.pct !== null ? previousData.pct : 0,
          'Attendance Percentage',
          '%'
        )}

        {renderComparisonBar(
          currentData.total,
          previousData.total,
          'Classes Held / Recorded'
        )}
      </div>

      {/* Subject list breakdown */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-brand-textSec uppercase tracking-wider">Subject Comparison</h3>

        {subjects.length === 0 ? (
          <div className="text-center py-8 bg-brand-card rounded-xl border border-brand-border">
            <Info className="mx-auto text-brand-textMuted mb-2 opacity-50" size={24} />
            <p className="text-brand-textSec text-sm">No subjects added yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {subjects.map((sub) => {
              const currSub = currentData.bySubject[sub.id] || { present: 0, total: 0, pct: null };
              const prevSub = previousData.bySubject[sub.id] || { present: 0, total: 0, pct: null };

              return (
                <div
                  key={sub.id}
                  className="bg-brand-card p-4 rounded-xl border border-brand-border flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: sub.color }}
                    />
                    <div>
                      <h4 className="font-extrabold text-brand-text text-sm">{sub.name}</h4>
                      <p className="text-xs text-brand-textMuted font-semibold">
                        {currentLabel}: {currSub.present}/{currSub.total} &middot; {previousLabel}: {prevSub.present}/{prevSub.total}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Previous value bubble */}
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-brand-textMuted uppercase">Prev</div>
                      <div className="text-xs font-bold text-brand-textSec">
                        {prevSub.pct !== null ? `${prevSub.pct.toFixed(0)}%` : '—'}
                      </div>
                    </div>

                    {/* Arrow / Trend (only show if both have values) */}
                    {currSub.pct !== null && prevSub.pct !== null && (
                      <div className="shrink-0">
                        <TrendingUp
                          size={16}
                          className={
                            currSub.pct >= prevSub.pct
                              ? 'text-status-safe'
                              : 'text-status-danger rotate-180 transition-transform'
                          }
                        />
                      </div>
                    )}

                    {/* Current value bubble */}
                    <div className="text-right min-w-[50px]">
                      <div className="text-[10px] font-bold text-brand-primary uppercase">Curr</div>
                      <div className="text-sm font-black text-brand-text">
                        {currSub.pct !== null ? `${currSub.pct.toFixed(0)}%` : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
