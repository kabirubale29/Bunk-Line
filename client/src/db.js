import localforage from 'localforage';

localforage.config({
  name: 'BunkLine',
  storeName: 'offline_store'
});

export const CACHE_KEYS = {
  SETTINGS: 'settings',
  TERMS: 'terms',
  SUBJECTS: 'subjects',
  SCHEDULE_SLOTS: 'schedule_slots',
  SCHEDULE_OVERRIDES: 'schedule_overrides',
  DAY_OVERRIDES: 'day_overrides',
  ATTENDANCE_RECORDS: 'attendance_records',
  ALERTS_SEEN: 'alerts_seen',
  SYNC_QUEUE: 'sync_queue',
  PROFILE: 'profile'
};

export async function saveCache(key, data) {
  try {
    await localforage.setItem(key, data);
  } catch (error) {
    console.error(`Error saving cache for ${key}:`, error);
  }
}

export async function getCache(key, defaultValue = null) {
  try {
    const val = await localforage.getItem(key);
    return val !== null ? val : defaultValue;
  } catch (error) {
    console.error(`Error reading cache for ${key}:`, error);
    return defaultValue;
  }
}

export async function clearCache() {
  try {
    await localforage.clear();
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

export async function enqueueSync(action, payload) {
  try {
    const queue = await getCache(CACHE_KEYS.SYNC_QUEUE, []);
    const operation = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Date.now().toString(),
      action,
      payload,
      timestamp: new Date().toISOString()
    };
    queue.push(operation);
    await saveCache(CACHE_KEYS.SYNC_QUEUE, queue);
    return operation;
  } catch (error) {
    console.error('Error enqueuing sync operation:', error);
    return null;
  }
}

export async function processSyncQueue(supabase, userId) {
  if (!supabase || !userId) return true;
  
  const queue = await getCache(CACHE_KEYS.SYNC_QUEUE, []);
  if (queue.length === 0) return true;

  console.log(`Processing offline sync queue of ${queue.length} items...`);
  const failedIds = [];

  for (const op of queue) {
    let success = false;
    try {
      const { action, payload } = op;

      // Inject user_id if object
      if (payload && typeof payload === 'object' && !payload.user_id) {
        payload.user_id = userId;
      }

      switch (action) {
        case 'settings/update': {
          const { error } = await supabase
            .from('settings')
            .upsert(payload);
          if (!error) success = true;
          break;
        }
        case 'term/create': {
          const { error } = await supabase.from('terms').insert(payload);
          if (!error) success = true;
          break;
        }
        case 'term/archive': {
          const { id, archived_at } = payload;
          const { error } = await supabase
            .from('terms')
            .update({ archived_at })
            .eq('id', id);
          if (!error) success = true;
          break;
        }
        case 'subject/create': {
          const { error } = await supabase.from('subjects').insert(payload);
          if (!error) success = true;
          break;
        }
        case 'subject/update': {
          const { id, ...updates } = payload;
          const { error } = await supabase
            .from('subjects')
            .update(updates)
            .eq('id', id);
          if (!error) success = true;
          break;
        }
        case 'subject/delete': {
          const { id } = payload;
          const { error } = await supabase
            .from('subjects')
            .delete()
            .eq('id', id);
          if (!error) success = true;
          break;
        }
        case 'slot/create': {
          const { error } = await supabase.from('schedule_slots').insert(payload);
          if (!error) success = true;
          break;
        }
        case 'slot/delete': {
          const { id } = payload;
          const { error } = await supabase
            .from('schedule_slots')
            .delete()
            .eq('id', id);
          if (!error) success = true;
          break;
        }
        case 'attendance/upsert': {
          const { error } = await supabase
            .from('attendance_records')
            .upsert(payload);
          if (!error) success = true;
          break;
        }
        case 'attendance/delete': {
          const { id } = payload;
          const { error } = await supabase
            .from('attendance_records')
            .delete()
            .eq('id', id);
          if (!error) success = true;
          break;
        }
        case 'override/create': {
          const { error } = await supabase.from('schedule_overrides').insert(payload);
          if (!error) success = true;
          break;
        }
        case 'override/delete': {
          const { id } = payload;
          const { error } = await supabase
            .from('schedule_overrides')
            .delete()
            .eq('id', id);
          if (!error) success = true;
          break;
        }
        case 'day_override/create': {
          const { error } = await supabase.from('day_overrides').insert(payload);
          if (!error) success = true;
          break;
        }
        case 'day_override/delete': {
          const { id } = payload;
          const { error } = await supabase
            .from('day_overrides')
            .delete()
            .eq('id', id);
          if (!error) success = true;
          break;
        }
        case 'alert/seen': {
          const { error } = await supabase.from('alerts_seen').insert(payload);
          if (!error) success = true;
          break;
        }
        default:
          console.warn('Unknown sync action:', action);
          success = true;
      }
    } catch (err) {
      console.error('Error executing sync operation:', err, op);
    }

    if (!success) {
      failedIds.push(op.id);
    }
  }

  const newQueue = queue.filter(op => failedIds.includes(op.id));
  await saveCache(CACHE_KEYS.SYNC_QUEUE, newQueue);

  return failedIds.length === 0;
}
