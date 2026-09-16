/**
 * @doc Billing region
 *
 * Chosen at sign-up: Arabic users are billed through Kashier (card +
 * e-wallets), everyone else through Dodo Payments. Stored locally and on the
 * auth user metadata so it survives across devices.
 */
export type PayRegion = "arab" | "global";

const KEY = "pay_region";

export function getPayRegion(): PayRegion | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(KEY);
    return v === "arab" || v === "global" ? v : null;
  } catch {
    return null;
  }
}

export function setPayRegion(region: PayRegion): void {
  try {
    localStorage.setItem(KEY, region);
  } catch {
    // ignore
  }
}

/** True when the account should use the Arabic (Kashier) payment gateways. */
export function isArabBilling(): boolean {
  return getPayRegion() === "arab";
}

/**
 * Best guess for a first-time visitor: Arabic browser language or an Arab
 * timezone → the Arabic (Kashier) edition, everyone else → global (Dodo).
 */
export function guessPayRegion(): PayRegion {
  if (typeof window === "undefined") return "global";
  const ARAB_COUNTRIES = new Set([
    "EG","SA","AE","KW","QA","BH","OM","JO","LB","SY","IQ","YE","PS","SD","LY","TN","DZ","MA","MR","SO","DJ","KM",
  ]);
  try {
    const locales = [navigator.language, ...(navigator.languages || [])].filter(Boolean) as string[];
    for (const raw of locales) {
      const l = raw.toLowerCase();
      if (l.startsWith("ar")) return "arab";
      // country subtag, e.g. "en-EG"
      const country = raw.split(/[-_]/)[1]?.toUpperCase();
      if (country && ARAB_COUNTRIES.has(country)) return "arab";
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (
      /^(Africa\/(Cairo|Algiers|Tunis|Tripoli|Khartoum|Casablanca|El_Aaiun|Nouakchott|Mogadishu|Djibouti|Juba)|Asia\/(Riyadh|Dubai|Kuwait|Qatar|Bahrain|Muscat|Baghdad|Amman|Beirut|Damascus|Aden|Gaza|Hebron)|Indian\/Comoro)$/.test(
        tz,
      )
    )
      return "arab";
  } catch {
    // ignore
  }
  return "global";
}

/** Stored choice, or the automatic guess when the visitor never picked one. */
export function getPayRegionOrGuess(): PayRegion {
  return getPayRegion() ?? guessPayRegion();
}

const ARAB_COUNTRY_CODES = new Set([
  "EG","SA","AE","KW","QA","BH","OM","JO","LB","SY","IQ","YE","PS","SD","LY","TN","DZ","MA","MR","SO","DJ","KM",
]);

/**
 * True when the visitor should see the Arabic-region offers (the $1 / 3-day
 * trial is sold through Kashier only). Uses the stored billing region first,
 * then the country resolved from the connection, then the browser guess.
 */
export function isArabRegion(): boolean {
  const stored = getPayRegion();
  if (stored) return stored === "arab";
  if (typeof window !== "undefined") {
    try {
      const geo = sessionStorage.getItem("megsy_geo_country");
      if (geo) return ARAB_COUNTRY_CODES.has(geo.toUpperCase());
    } catch {
      // ignore
    }
  }
  return guessPayRegion() === "arab";
}
