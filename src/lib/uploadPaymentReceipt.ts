import { getSupabaseBrowserClient } from './supabaseClient';
import type { PayCurrency } from './payCurrencyPreference';
import { getOrCreateDeviceId } from './supabaseUserProgress';

export type PaymentReceiptSource = 'vip_modal' | 'coin_shop';

const MAX_BYTES = 5 * 1024 * 1024;

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

function safeFileSegment(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
  return base || 'receipt';
}

function isConfigured(): boolean {
  return getSupabaseBrowserClient() != null && getSupabaseRestConfig() != null;
}

export function isPaymentReceiptUploadConfigured(): boolean {
  return isConfigured();
}

/**
 * Çeki Storage-a yükləyir + `payment_receipts` cədvəlinə sətir əlavə edir.
 * Supabase konfiqurasiyası yoxdursa `not_configured` qaytarır.
 */
export async function uploadPaymentReceipt(params: {
  file: File;
  source: PaymentReceiptSource;
  currency: PayCurrency;
}): Promise<{ ok: true; storagePath: string } | { ok: false; reason: 'not_configured' | 'too_large' | 'not_image' | 'upload' }> {
  const sb = getSupabaseBrowserClient();
  const cfg = getSupabaseRestConfig();
  if (!sb || !cfg) return { ok: false, reason: 'not_configured' };

  if (!params.file.type.startsWith('image/')) {
    return { ok: false, reason: 'not_image' };
  }
  if (params.file.size > MAX_BYTES) {
    return { ok: false, reason: 'too_large' };
  }

  const deviceId = getOrCreateDeviceId();
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `r-${Date.now()}`;
  const path = `receipts/${deviceId}/${id}_${safeFileSegment(params.file.name)}`;

  const { error: upErr } = await sb.storage.from('payment-receipts').upload(path, params.file, {
    cacheControl: '3600',
    upsert: false,
    contentType: params.file.type || 'image/jpeg',
  });

  if (upErr) {
    return { ok: false, reason: 'upload' };
  }

  const row = {
    device_id: deviceId,
    source: params.source,
    currency: params.currency,
    storage_path: path,
    file_mime: params.file.type || null,
    created_at: new Date().toISOString(),
  };

  const res = await fetch(`${cfg.url}/rest/v1/payment_receipts`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    return { ok: false, reason: 'upload' };
  }

  return { ok: true, storagePath: path };
}
