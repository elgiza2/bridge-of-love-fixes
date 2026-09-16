/**
 * Local-currency display for prices.
 *
 * Checkout itself is charged in USD (Dodo) or EGP (Kashier). This module only
 * adds a familiar-looking secondary price so an Arabic visitor is not forced to
 * convert dollars in their head. Rates are indicative and rounded on purpose —
 * every rendered string is prefixed with "≈".
 *
 * Country comes from the device: the IANA timezone first (stable, no prompt),
 * then the browser locale region as a fallback. Nothing is fetched.
 */

type Money = { code: string; rate: number };

/** Approximate units of local currency per 1 USD. */
const CURRENCY_BY_COUNTRY: Record<string, Money> = {
  EG: { code: "EGP", rate: 48 },
  SA: { code: "SAR", rate: 3.75 },
  AE: { code: "AED", rate: 3.67 },
  QA: { code: "QAR", rate: 3.64 },
  KW: { code: "KWD", rate: 0.31 },
  BH: { code: "BHD", rate: 0.376 },
  OM: { code: "OMR", rate: 0.385 },
  JO: { code: "JOD", rate: 0.71 },
  LB: { code: "LBP", rate: 89000 },
  IQ: { code: "IQD", rate: 1310 },
  MA: { code: "MAD", rate: 9.9 },
  DZ: { code: "DZD", rate: 134 },
  TN: { code: "TND", rate: 3.1 },
  LY: { code: "LYD", rate: 4.85 },
  SD: { code: "SDG", rate: 600 },
  YE: { code: "YER", rate: 250 },
  SY: { code: "SYP", rate: 13000 },
  MR: { code: "MRU", rate: 39.6 },
  PS: { code: "ILS", rate: 3.7 },
  SO: { code: "SOS", rate: 571 },
  DJ: { code: "DJF", rate: 178 },
  KM: { code: "KMF", rate: 455 },
};

/** Timezones that identify a country whose zone name is not country-specific. */
const ZONE_TO_COUNTRY: Record<string, string> = {
  "Africa/Cairo": "EG",
  "Asia/Riyadh": "SA",
  "Asia/Dubai": "AE",
  "Asia/Qatar": "QA",
  "Asia/Kuwait": "KW",
  "Asia/Bahrain": "BH",
  "Asia/Muscat": "OM",
  "Asia/Amman": "JO",
  "Asia/Beirut": "LB",
  "Asia/Baghdad": "IQ",
  "Asia/Damascus": "SY",
  "Asia/Gaza": "PS",
  "Asia/Hebron": "PS",
  "Asia/Aden": "YE",
  "Africa/Casablanca": "MA",
  "Africa/Algiers": "DZ",
  "Africa/Tunis": "TN",
  "Africa/Tripoli": "LY",
  "Africa/Khartoum": "SD",
  "Africa/Nouakchott": "MR",
  "Africa/Mogadishu": "SO",
  "Africa/Djibouti": "DJ",
  "Indian/Comoro": "KM",
};

/** Best-effort country code for the current device, or null. */
export function detectCountry(): string | null {
  if (typeof Intl === "undefined") return null;
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone && ZONE_TO_COUNTRY[zone]) return ZONE_TO_COUNTRY[zone];
  } catch {
    // resolvedOptions can throw on very old engines — fall through to locale.
  }
  const locale =
    (typeof navigator !== "undefined" && (navigator.languages?.[0] || navigator.language)) || "";
  const region = locale.split("-")[1];
  return region ? region.toUpperCase() : null;
}

/** Currency for the current device, when it is one we display. */
export function detectLocalMoney(): Money | null {
  const country = detectCountry();
  return country ? (CURRENCY_BY_COUNTRY[country] ?? null) : null;
}

export type { Money };

/**
 * "1,400 EGP" — the same converted amount without the "≈" prefix, for places
 * where the local price is the headline instead of a hint.
 */
export function formatLocalAmount(usd: number, money: Money | null): string | null {
  const s = formatLocalPrice(usd, money);
  return s ? s.replace(/^≈\s*/, "") : null;
}

/**
 * "≈ 1,400 EGP" for a USD amount, or null when the device has no mapped
 * currency (or is already on USD).
 */
export function formatLocalPrice(usd: number, money: Money | null): string | null {
  if (!money || !Number.isFinite(usd) || usd <= 0) return null;
  const value = usd * money.rate;
  // Sub-unit currencies (KWD, BHD, OMR) need decimals to stay meaningful.
  const decimals = value < 10 ? 2 : 0;
  const rounded = decimals === 0 ? Math.round(value / 5) * 5 : Number(value.toFixed(decimals));
  try {
    return `≈ ${new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: money.code,
      maximumFractionDigits: decimals,
      minimumFractionDigits: 0,
    }).format(rounded)}`;
  } catch {
    return `≈ ${rounded} ${money.code}`;
  }
}
