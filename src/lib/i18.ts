import { browser } from '$app/environment'

export const defaultLocale = 'en'
export const supported = ["en", "kr"] as const;

function toSupported(tag: string): (typeof supported)[number] {
  const t = tag.toLowerCase().replace("_", "-"); // e.g. "ko-kr"
  // direct match first
  if (supported.includes(t as any)) return t as any;

  const lang = t.split("-")[0]; // e.g. "ko"
  if (lang === "ko") return "kr"; // map ko* -> kr
  if (lang === "en") return "en";
  return "en";
}

// Detect locale on server or client
export function detectLocale(event?: any) {
  if (!browser && event) {
    // On server: extract from accept-language header
    const acceptLanguage = event.request.headers.get('accept-language')
    if (acceptLanguage) {
      const locale = acceptLanguage.split(',')[0].split('-')[0] // e.g. 'en-US' => 'en'
      return toSupported(locale)
    }
    return defaultLocale
  } else if (browser) {
    // On client: use navigator.language
    return toSupported(navigator.language?.split('-')[0] || defaultLocale)
  }
  
  return defaultLocale
}