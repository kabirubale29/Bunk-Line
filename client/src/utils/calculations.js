/**
 * Calculations for Bunk Line Attendance Tracker
 */

/**
 * Calculates attendance status details for a subject.
 * 
 * @param {Object} params
 * @param {number} params.present - Count of present markings in app
 * @param {number} params.absent - Count of absent markings in app
 * @param {Object} params.baseline - { totalHeld: number, totalAttended: number }
 * @param {number} params.minAttendancePct - Threshold percentage (e.g. 60)
 * @returns {Object} { pct, presentCount, absentCount, totalCount, status, verdict, safeToSkip, mustAttend }
 */
export function calculateAttendance({
  present = 0,
  absent = 0,
  baseline = { totalHeld: 0, totalAttended: 0 },
  minAttendancePct = 60
}) {
  const bHeld = baseline?.totalHeld || 0;
  const bAttended = baseline?.totalAttended || 0;
  const bAbsent = bHeld - bAttended;

  const totalPresent = present + bAttended;
  const totalAbsent = absent + bAbsent;
  const totalHeld = totalPresent + totalAbsent;

  const t = minAttendancePct / 100;
  const pct = totalHeld > 0 ? (totalPresent / totalHeld) * 100 : null;

  let safeToSkip = 0;
  let mustAttend = 0;
  let verdict = '';
  let status = 'SAFE'; // SAFE, BORDERLINE, DANGER

  if (pct === null) {
    verdict = 'No classes held yet';
    status = 'SAFE';
  } else if (pct >= minAttendancePct) {
    // Safe to skip calculation
    // x = floor(present / t - total)
    if (t > 0) {
      safeToSkip = Math.floor(totalPresent / t - totalHeld);
      safeToSkip = Math.max(0, safeToSkip);
    } else {
      safeToSkip = 999; // 0% minimum means safe forever
    }

    if (pct >= minAttendancePct + 8) {
      status = 'SAFE';
      verdict = safeToSkip === 0 
        ? `Borderline safe. You cannot miss the next class.`
        : `Safe — you can miss ${safeToSkip} more and stay above ${minAttendancePct}%.`;
    } else {
      status = 'BORDERLINE';
      verdict = safeToSkip === 0
        ? `Borderline safe. One more absence puts you at risk.`
        : `Borderline safe — you can miss ${safeToSkip} more class${safeToSkip > 1 ? 'es' : ''}.`;
    }
  } else {
    // Must attend in a row calculation
    // y = ceil((t * total - present) / (1 - t))
    if (t < 1) {
      mustAttend = Math.ceil((t * totalHeld - totalPresent) / (1 - t));
      mustAttend = Math.max(1, mustAttend);
    } else {
      mustAttend = 999; // 100% minimum and below it means impossible or infinite
    }
    status = 'DANGER';
    verdict = `Danger — attend the next ${mustAttend} class${mustAttend > 1 ? 'es' : ''} in a row to recover to ${minAttendancePct}%.`;
  }

  return {
    pct,
    presentCount: totalPresent,
    absentCount: totalAbsent,
    totalCount: totalHeld,
    status,
    verdict,
    safeToSkip,
    mustAttend
  };
}

/**
 * Calculates current present streak for a subject.
 * Does not count baseline attendance; only actual records stored in app.
 * Present = continues streak, Absent = breaks streak, Cancelled = ignored.
 * 
 * @param {Array} records - Attendance records for this subject in descending chronological order
 * @returns {number}
 */
export function calculateStreak(records = []) {
  let streak = 0;
  // Sort descending by date, then by marked_at/time if multiple in same day
  const sorted = [...records].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    const markedA = a.marked_at ? new Date(a.marked_at).getTime() : 0;
    const markedB = b.marked_at ? new Date(b.marked_at).getTime() : 0;
    return markedB - markedA;
  });

  for (const record of sorted) {
    if (record.status === 'cancelled') {
      continue; // Cancelled doesn't break or count
    }
    if (record.status === 'present') {
      streak++;
    } else if (record.status === 'absent') {
      break; // Absent breaks the streak
    }
  }
  return streak;
}

/**
 * Simulates a hypothetical what-if scenario.
 * 
 * @param {Object} params
 * @param {number} params.present - Real present markings
 * @param {number} params.absent - Real absent markings
 * @param {Object} params.baseline - Baseline config
 * @param {number} params.minAttendancePct - Threshold
 * @param {string} params.action - 'attend' | 'skip' | 'custom_skip'
 * @param {number} params.count - Count for custom skip/attend
 * @returns {Object} The recalculated attendance object
 */
export function simulateWhatIf({
  present = 0,
  absent = 0,
  baseline = { totalHeld: 0, totalAttended: 0 },
  minAttendancePct = 60,
  action = 'attend',
  count = 1
}) {
  let simulatedPresent = present;
  let simulatedAbsent = absent;

  if (action === 'attend') {
    simulatedPresent += count;
  } else if (action === 'skip') {
    simulatedAbsent += count;
  }

  return calculateAttendance({
    present: simulatedPresent,
    absent: simulatedAbsent,
    baseline,
    minAttendancePct
  });
}

/**
 * Get Zone color based on percentage and threshold.
 * Red if % < threshold
 * Amber if threshold <= % < threshold + 8
 * Green if % >= threshold + 8
 */
export function getZoneColor(pct, threshold) {
  if (pct === null || pct === undefined) return '#9299A8'; // Muted secondary
  if (pct < threshold) return '#EF4444'; // Danger
  if (pct < threshold + 8) return '#F59E0B'; // Warning/Borderline
  return '#22C55E'; // Safe
}
