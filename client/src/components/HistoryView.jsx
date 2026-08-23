import React, { useState } from 'react';
import { ArrowLeft, Calendar, Edit2, MessageSquare, Trash2, Filter } from 'lucide-react';

export default function HistoryView({
  records = [],
  subjects = [],
  overrides = [],
  dayOverrides = [],
  onBack,
  onUpdateRecord,
  onDeleteRecord,
}) {
  const [selectedSubjectId, setSelectedSubjectId] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Map subjects for easy lookup
  const subjectMap = subjects.reduce((acc, sub) => {
    acc[sub.id] = sub;
    return acc;
  }, {});

  // Group override lookups
  const overrideMap = overrides.reduce((acc, over) => {
    acc[over.id] = over;
    return acc;
  }, {});

  // Combine records and day overrides (holidays)
  const combinedHistory = [
    ...records.map((r) => ({
      ...r,
      historyType: 'attendance',
      key: `record-${r.id || r.date + '-' + (r.slot_id || r.override_id)}`,
    })),
    ...dayOverrides
      .filter((doOverride) => doOverride.type === 'holiday')
      .map((doOverride) => ({
        id: doOverride.id,
        date: doOverride.date,
        status: 'holiday',
        historyType: 'holiday',
        key: `holiday-${doOverride.id || doOverride.date}`,
      })),
  ];

  // Sort: date descending, then marked_at descending
  combinedHistory.sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    const timeA = a.marked_at ? new Date(a.marked_at).getTime() : 0;
    const timeB = b.marked_at ? new Date(b.marked_at).getTime() : 0;
    return timeB - timeA;
  });

  // Filter history
  const filteredHistory = combinedHistory.filter((item) => {
    if (item.historyType === 'holiday') {
      return selectedSubjectId === 'all' && (selectedStatus === 'all' || selectedStatus === 'holiday');
    }
    const subMatch = selectedSubjectId === 'all' || item.subject_id === selectedSubjectId;
    const statusMatch = selectedStatus === 'all' || item.status === selectedStatus;
    return subMatch && statusMatch;
  });

  const getStatusStyle = (status) => {
    switch (status) {
      case 'present':
        return 'bg-green-500/10 text-status-safe border-green-500/20';
      case 'absent':
        return 'bg-red-500/10 text-status-danger border-red-500/20';
      case 'cancelled':
        return 'bg-gray-500/10 text-brand-textMuted border-gray-500/20';
      case 'holiday':
        return 'bg-amber-500/10 text-status-warning border-amber-500/20';
      default:
        return 'bg-brand-cardEl text-brand-textSec border-brand-border';
    }
  };

  const formatMarkedTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-24 md:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 sticky top-0 bg-brand-bg/95 py-3 z-10 backdrop-blur-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-brand-textMuted hover:text-brand-text font-bold text-sm transition-colors py-2"
        >
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
        <h2 className="text-xl font-extrabold text-brand-text">Attendance History</h2>
        <div className="w-12" /> {/* spacer */}
      </div>

      {/* Filters */}
      <div className="bg-brand-card p-4 rounded-xl border border-brand-border mb-6 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[10px] font-bold text-brand-textMuted uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Filter size={10} /> Subject
          </label>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg bg-brand-cardEl border border-brand-border text-brand-text focus:outline-none focus:border-brand-primary"
          >
            <option value="all">All Subjects</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[140px]">
          <label className="block text-[10px] font-bold text-brand-textMuted uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Filter size={10} /> Status
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg bg-brand-cardEl border border-brand-border text-brand-text focus:outline-none focus:border-brand-primary"
          >
            <option value="all">All Statuses</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="cancelled">Cancelled</option>
            <option value="holiday">Holiday</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filteredHistory.length === 0 ? (
          <div className="text-center py-12 bg-brand-card rounded-xl border border-brand-border">
            <Calendar className="mx-auto text-brand-textMuted mb-2 opacity-50" size={32} />
            <p className="text-brand-textSec text-sm font-semibold">No records found</p>
            <p className="text-xs text-brand-textMuted mt-1">Adjust filters or mark classes first.</p>
          </div>
        ) : (
          filteredHistory.map((item) => {
            const isHoliday = item.historyType === 'holiday';
            const subject = !isHoliday ? subjectMap[item.subject_id] : null;
            const hasOverride = !isHoliday && !!item.override_id;

            return (
              <div
                key={item.key}
                className="bg-brand-card p-4 rounded-xl border border-brand-border transition-all flex justify-between items-start gap-3"
              >
                <div className="space-y-1">
                  <div className="text-xs font-bold text-brand-textMuted uppercase tracking-wider">
                    {formatDate(item.date)}
                  </div>

                  <div className="flex items-center gap-2">
                    {isHoliday ? (
                      <span className="font-extrabold text-brand-text text-base">Whole-Day Holiday</span>
                    ) : (
                      <>
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: subject?.color || '#9299A8' }}
                        />
                        <span className="font-extrabold text-brand-text text-base">
                          {subject?.name || 'Deleted Subject'}
                        </span>
                      </>
                    )}
                  </div>

                  {!isHoliday && (
                    <div className="text-xs text-brand-textMuted flex flex-wrap gap-2 items-center">
                      {item.marked_at && (
                        <span>Marked at {formatMarkedTime(item.marked_at)}</span>
                      )}
                      {item.edited && (
                        <span className="px-1.5 py-0.5 bg-brand-cardEl text-brand-textMuted rounded text-[10px] font-bold">
                          EDITED
                        </span>
                      )}
                      {hasOverride && (
                        <span className="px-1.5 py-0.5 bg-status-info/10 text-status-info rounded text-[10px] font-bold">
                          MODIFIED
                        </span>
                      )}
                    </div>
                  )}

                  {!isHoliday && item.note && (
                    <div className="text-xs text-brand-textSec italic bg-brand-cardEl/40 p-2 rounded-lg border border-brand-border/40 mt-1 flex items-start gap-1">
                      <MessageSquare size={12} className="shrink-0 text-brand-textMuted mt-0.5" />
                      <span>"{item.note}"</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2.5 shrink-0">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-extrabold border ${getStatusStyle(
                      item.status
                    )}`}
                  >
                    {item.status.toUpperCase()}
                  </span>

                  {!isHoliday && (onUpdateRecord || onDeleteRecord) && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const newNote = prompt('Edit note for this record:', item.note || '');
                          if (newNote !== null) {
                            onUpdateRecord(item.id, { note: newNote });
                          }
                        }}
                        className="p-1.5 text-brand-textMuted hover:text-brand-primary transition-colors rounded-lg hover:bg-brand-cardEl"
                        title="Edit Note"
                      >
                        <MessageSquare size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this attendance record? This will count as unmarked.')) {
                            onDeleteRecord(item.id);
                          }
                        }}
                        className="p-1.5 text-brand-textMuted hover:text-status-danger transition-colors rounded-lg hover:bg-brand-cardEl"
                        title="Delete Record"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}

                  {isHoliday && onDeleteRecord && (
                    <button
                      onClick={() => {
                        if (confirm('Remove holiday override for this date?')) {
                          onDeleteRecord(item.id, true);
                        }
                      }}
                      className="p-1.5 text-brand-textMuted hover:text-status-danger transition-colors rounded-lg hover:bg-brand-cardEl"
                      title="Remove Holiday"
                    >
                      <Trash2 size={14} />
                    </button>
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
