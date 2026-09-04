/**
 * Notification Service for Lock-Screen Quick-Mark Interactive Notifications
 */

export async function checkNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    alert('Push / Web Notifications are not supported in this browser.');
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return 'denied';
  }
}

/**
 * Sends a rich actionable class notification to the device's lock screen & notification shade
 */
export async function sendClassQuickMarkNotification({ slot, subject, date, termId, userId }) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    if (!registration) {
      console.warn('Service worker not ready to show notification.');
      return false;
    }

    const formatTime = (timeStr) => {
      if (!timeStr) return '';
      const [h, m] = timeStr.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      return `${displayH}:${String(m).padStart(2, '0')} ${ampm}`;
    };

    const periodStr = slot.period ? `Period ${slot.period}` : 'Class';
    const timeStr = slot.start_time ? ` (${formatTime(slot.start_time)} – ${formatTime(slot.end_time)})` : '';
    const title = `Bunk Line: ${subject?.name || 'Class'}`;
    const body = `${periodStr}${timeStr} · Quick-mark your attendance:`;

    await registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `bunkline-slot-${date}-${slot.id}`,
      renotify: true,
      requireInteraction: true,
      data: { slot, subject, date, termId, userId },
      actions: [
        { action: 'present', title: '✅ Present' },
        { action: 'absent', title: '❌ Absent' }
      ]
    });

    return true;
  } catch (err) {
    console.error('Failed to show notification:', err);
    return false;
  }
}

/**
 * Triggers interactive lock-screen notifications for all unmarked classes today
 */
export async function triggerDailyQuickMarkNotifications({ todaySlots = [], records = [], subjects = [], date, termId, userId }) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    const perm = await requestNotificationPermission();
    if (perm !== 'granted') return 0;
  }

  const subjectMap = subjects.reduce((acc, sub) => {
    acc[sub.id] = sub;
    return acc;
  }, {});

  let sentCount = 0;

  for (const slot of todaySlots) {
    const isMarked = records.some(
      (r) =>
        r.date === date &&
        (slot.isExtra
          ? r.override_id === slot.override_id
          : r.slot_id === (slot.override_id ? slot.original_slot_id : slot.id))
    );

    // Only send notification for unmarked classes
    if (!isMarked) {
      const sub = subjectMap[slot.subject_id];
      const success = await sendClassQuickMarkNotification({
        slot,
        subject: sub,
        date,
        termId,
        userId
      });
      if (success) sentCount++;
    }
  }

  return sentCount;
}
