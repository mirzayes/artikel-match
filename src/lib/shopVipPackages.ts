import type { PayCurrency } from './payCurrencyPreference';

/** VIP / mağaza: eyni paketlər (AZN və EUR). */
export const SHOP_VIP_PACKS = [
  {
    id: '1m',
    periodKey: 'coin_shop.pack_period_1m' as const,
    azn: 7.99,
    eur: 7.99,
    badge: null as null | 'value' | 'best',
    /** UI vurğusu */
    emphasis: 'default' as const,
  },
  {
    id: '3m',
    periodKey: 'coin_shop.pack_period_3m' as const,
    azn: 16.99,
    eur: 16.99,
    badge: 'value' as const,
    emphasis: 'value' as const,
  },
  {
    id: '12m',
    periodKey: 'coin_shop.pack_period_12m' as const,
    azn: 69.99,
    eur: 69.99,
    badge: 'best' as const,
    emphasis: 'best' as const,
  },
] as const;

export type ShopVipPack = (typeof SHOP_VIP_PACKS)[number];

export function packPriceForCurrency(pack: ShopVipPack, currency: PayCurrency): number {
  return currency === 'AZN' ? pack.azn : pack.eur;
}

/** Göstərim: həmişə iki onluq (7.99). */
export function formatPackPrice(amount: number): string {
  return amount.toFixed(2);
}
