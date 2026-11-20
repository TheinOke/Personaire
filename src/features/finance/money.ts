import {
  Briefcase,
  Bus,
  Car,
  Coffee,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Laptop,
  Music,
  PiggyBank,
  Plane,
  Receipt,
  ShoppingBag,
  Smartphone,
  Tag,
  TrendingUp,
  Utensils,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export const MONEY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  coffee: Coffee,
  bus: Bus,
  car: Car,
  house: House,
  receipt: Receipt,
  'shopping-bag': ShoppingBag,
  smartphone: Smartphone,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  music: Music,
  plane: Plane,
  gift: Gift,
  briefcase: Briefcase,
  laptop: Laptop,
  'trending-up': TrendingUp,
  'piggy-bank': PiggyBank,
  wallet: Wallet,
  tag: Tag,
}

export function moneyIcon(name: string | null | undefined): LucideIcon {
  return (name && MONEY_ICONS[name]) || Tag
}

/** Common currencies for the Settings picker. */
export const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'MMK', 'THB', 'SGD', 'MYR', 'IDR', 'PHP', 'VND', 'INR', 'JPY', 'KRW', 'CNY', 'HKD', 'TWD',
  'AUD', 'NZD', 'CAD', 'CHF', 'SEK', 'NOK', 'DKK', 'AED', 'SAR', 'ZAR', 'BRL', 'MXN',
]

const formatters = new Map<string, Intl.NumberFormat>()

/** Currencies where cents/decimals aren't used day to day. */
const NO_DECIMALS = new Set(['MMK', 'IDR', 'VND', 'KRW', 'JPY', 'LAK', 'KHR', 'UGX'])

/** Format an amount in the user's currency, e.g. "$1,234.50". */
export function money(amount: number, currency = 'USD', opts: { sign?: boolean; compact?: boolean } = {}) {
  const key = `${currency}|${opts.compact ? 'c' : ''}`
  let f = formatters.get(key)
  if (!f) {
    try {
      f = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        ...(NO_DECIMALS.has(currency) ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
        ...(opts.compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
      })
    } catch {
      f = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })
    }
    formatters.set(key, f)
  }
  const text = f.format(Math.abs(amount))
  if (amount < 0) return `−${text}`
  return opts.sign && amount > 0 ? `+${text}` : text
}

/** Parse what the user typed ("12.50", "12,50", "1,234.5") → number or NaN. */
export function parseAmount(input: string): number {
  let s = input.trim().replace(/\s/g, '')
  if (!s) return NaN
  // "1.234,56" or "12,5" → decimal comma
  if (/,\d{1,2}$/.test(s) && !/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(/,/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN
}
