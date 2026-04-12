/**
 * Ödəniş: kart (AZN), PayPal (EUR), Instagram təsdiq.
 */

export function instagramCheckoutUrl(): string {
  const direct = (import.meta.env.VITE_INSTAGRAM_CHECKOUT_URL ?? '').trim();
  if (direct) return direct;
  const u = (import.meta.env.VITE_SUPPORT_INSTAGRAM_URL ?? '').trim();
  if (u) return u;
  const h = (import.meta.env.VITE_SUPPORT_INSTAGRAM_HANDLE ?? 'artikelmatch').trim().replace(/^@/, '');
  return `https://www.instagram.com/${encodeURIComponent(h)}/`;
}

const PAYPAL_EMAIL_DEFAULT = 'mirzayes1993@gmail.com';

/** PayPal ödənişi üçün e-poçt (mətn / kopyalama). */
export function paypalRecipientEmail(): string {
  const e = (import.meta.env.VITE_PAYPAL_RECIPIENT_EMAIL ?? '').trim();
  return e || PAYPAL_EMAIL_DEFAULT;
}

/**
 * Açılacaq PayPal səhifəsi. `VITE_PAYPAL_ME_URL` tam link və ya istifadəçi adı,
 * və ya `VITE_PAYPAL_ME_USERNAME` — https://www.paypal.com/paypalme/…
 * Boşdursa null (düymə e-poçtu kopyalayır).
 */
export function paypalCheckoutUrl(): string | null {
  const raw = (import.meta.env.VITE_PAYPAL_ME_URL ?? '').trim();
  if (raw) {
    if (/^https?:\/\//i.test(raw)) return raw;
    const nickFromRaw = raw.replace(/^@/, '').replace(/\/+$/, '');
    if (nickFromRaw && !nickFromRaw.includes('@') && !nickFromRaw.includes(' ')) {
      return `https://www.paypal.com/paypalme/${encodeURIComponent(nickFromRaw)}`;
    }
  }
  const nick = (import.meta.env.VITE_PAYPAL_ME_USERNAME ?? '').trim().replace(/^@/, '').replace(/\/+$/, '');
  if (!nick) return null;
  return `https://www.paypal.com/paypalme/${encodeURIComponent(nick)}`;
}

/** Donasiya fallback: PayPal linki və ya boş. */
export function paypalMeUrl(): string {
  return paypalCheckoutUrl() ?? '';
}

/** «Kofe al» — xüsusi donat, sonra Ko-fi, sonra PayPal linki. */
export function donationCoffeeUrl(): string {
  const custom = (import.meta.env.VITE_DONATION_COFFEE_URL ?? '').trim();
  if (custom) return custom;
  const kofi = (import.meta.env.VITE_BUY_ME_A_COFFEE_URL ?? '').trim();
  if (kofi) return kofi;
  return paypalMeUrl();
}

/** Bakı AZN ödəniş kartı (göstərmə). Boşdursa bu nömrə; fərqli kart üçün `VITE_PAYMENT_CARD_PAN`. */
export const DEFAULT_AZN_CARD_DISPLAY = '4169 7388 2978 9845';

export function paymentCardDisplay(): string {
  const card = (import.meta.env.VITE_PAYMENT_CARD_PAN ?? '').trim();
  if (card) return card;
  return DEFAULT_AZN_CARD_DISPLAY;
}

export function paymentCardPlainForCopy(): string {
  return paymentCardDisplay().replace(/\s+/g, '').replace(/-/g, '');
}
