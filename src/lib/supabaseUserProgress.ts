import type { GoetheLevel } from '../types';

export type RemoteProgressStatus = 'hard' | 'mastered' | 'review';

function getSupabaseRestConfig(): { url: string; key: string } | null {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!url || !key || url.includes('YOUR_PROJECT') || url.includes('placeholder')) return null;
    return { url: url.replace(/\/$/, ''), key };
  } catch {
    return null;
  }
}

export function getOrCreateDeviceId(): string {
  try {
    const k = 'artikel-progress-device-id';
    let id = localStorage.getItem(k);
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `d-${Date.now()}`;
      localStorage.setItem(k, id);
    }
    return id;
  } catch {
    return 'unknown-device';
  }
}

/**
 * user_progress cədvəlinə asinxron yazı (UI bloklamır).
 * Konfiqurasiya yoxdursa və ya xəta olsa — səssiz no-op.
 */
export function queueUserProgressRemote(params: {
  wordId: string;
  level: GoetheLevel;
  status: RemoteProgressStatus;
}): void {
  const cfg = getSupabaseRestConfig();
  if (!cfg) return;

  const body = {
    device_id: getOrCreateDeviceId(),
    word_id: params.wordId,
    level: params.level,
    status: params.status,
    updated_at: new Date().toISOString(),
  };

  void fetch(`${cfg.url}/rest/v1/user_progress`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(body),
  }).catch(() => {
    /* şəbəkə/RLS — yerli progress saxlanılır */
  });
}
