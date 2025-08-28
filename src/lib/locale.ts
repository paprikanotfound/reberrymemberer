// src/lib/i18n.ts
import { setLocale } from "$paraglide/runtime.js";

// detect browser language (e.g. "en-US" → "en")
const browserLang =
  typeof navigator !== "undefined"
    ? navigator.language.split("-")[0]
    : "en";

// only allow supported locales
const supported = ["en", "kr"];
const initialLocale = supported.includes(browserLang) ? browserLang : "en";

// set locale globally
setLocale(initialLocale);

export { initialLocale };
