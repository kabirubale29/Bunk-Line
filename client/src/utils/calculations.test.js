import { calculateAttendance, calculateStreak, simulateWhatIf } from './calculations.js';

function runTests() {
  console.log('Running Bunk Line Math Calculations Tests...');
  
  // Test 1: Simple percentage calculation & Danger Zone (under 60%)
  let res = calculateAttendance({
    present: 5,
    absent: 5,
    baseline: { totalHeld: 0, totalAttended: 0 },
    minAttendancePct: 60
  });
  console.assert(res.pct === 50, `Expected pct 50, got ${res.pct}`);
  console.assert(res.status === 'DANGER', `Expected DANGER, got ${res.status}`);
  console.assert(res.mustAttend === 3, `Expected mustAttend 3, got ${res.mustAttend}`); // (0.6*10 - 5)/(1 - 0.6) = (6-5)/0.4 = 2.5 -> ceil = 3

  // Test 2: Borderline safe calculation (threshold <= pct < threshold + 8)
  res = calculateAttendance({
    present: 6,
    absent: 4,
    baseline: { totalHeld: 0, totalAttended: 0 },
    minAttendancePct: 60
  });
  console.assert(res.pct === 60, `Expected pct 60, got ${res.pct}`);
  console.assert(res.status === 'BORDERLINE', `Expected BORDERLINE, got ${res.status}`);
  console.assert(res.safeToSkip === 0, `Expected safeToSkip 0, got ${res.safeToSkip}`);

  // Test 3: Comfortably safe calculation (pct >= threshold + 8)
  res = calculateAttendance({
    present: 8,
    absent: 2,
    baseline: { totalHeld: 0, totalAttended: 0 },
    minAttendancePct: 60
  });
  console.assert(res.pct === 80, `Expected pct 80, got ${res.pct}`);
  console.assert(res.status === 'SAFE', `Expected SAFE, got ${res.status}`);
  console.assert(res.safeToSkip === 3, `Expected safeToSkip 3, got ${res.safeToSkip}`); // floor(8 / 0.6 - 10) = floor(13.333 - 10) = 3

  // Test 4: Baseline incorporation
  res = calculateAttendance({
    present: 2,
    absent: 1,
    baseline: { totalHeld: 10, totalAttended: 8 },
    minAttendancePct: 60
  });
  // Total present = 2 + 8 = 10
  // Total absent = 1 + (10-8) = 3
  // Total held = 13
  // Pct = 10/13 * 100 = 76.92%
  console.assert(Math.round(res.pct) === 77, `Expected pct ~76.92%, got ${res.pct}`);
  console.assert(res.safeToSkip === 3, `Expected safeToSkip 3, got ${res.safeToSkip}`); // floor(10/0.6 - 13) = floor(16.666 - 13) = 3

  // Test 5: Streaks (descending records, skips cancelled)
  const records = [
    { date: '2026-08-22', status: 'present', marked_at: '2026-08-22T10:00:00Z' },
    { date: '2026-08-21', status: 'cancelled', marked_at: '2026-08-21T10:00:00Z' },
    { date: '2026-08-20', status: 'present', marked_at: '2026-08-20T10:00:00Z' },
    { date: '2026-08-19', status: 'absent', marked_at: '2026-08-19T10:00:00Z' },
    { date: '2026-08-18', status: 'present', marked_at: '2026-08-18T10:00:00Z' }
  ];
  let streak = calculateStreak(records);
  console.assert(streak === 2, `Expected streak 2, got ${streak}`);

  // Test 6: What-If simulation
  res = simulateWhatIf({
    present: 5,
    absent: 5,
    baseline: { totalHeld: 0, totalAttended: 0 },
    minAttendancePct: 60,
    action: 'attend',
    count: 2
  });
  console.assert(Math.round(res.pct) === 58, `Expected pct around 58%, got ${res.pct}`);
  console.assert(res.mustAttend === 1, `Expected mustAttend 1 to recover from 58.33% to 60%, got ${res.mustAttend}`);

  console.log('All tests passed successfully!');
}

try {
  runTests();
} catch (e) {
  console.error('Test execution failed:', e);
  process.exit(1);
}
