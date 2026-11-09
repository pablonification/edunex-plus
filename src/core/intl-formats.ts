// Intl's date and number formatters, made once per locale and options and kept. Making one is slow on the phone
// (Hermes asks Android's own ICU for it, through Java), and the screens made several per component each minute: every
// date on screen goes through makeFormat (./format.ts), and Beranda's reasoning words dates for both languages
// (./dates.ts). A formatter keeps the time zone it was made in, so a change of zone (a trip, the clock's settings)
// makes new ones.

const dates = new Map<string, Intl.DateTimeFormat>();
const numbers = new Map<string, Intl.NumberFormat>();

/** The zone the formatters are made in, as its offset from UTC now: a new one gets new formatters. */
const zone = () => new Date().getTimezoneOffset();

export function dateTimeFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${zone()}|${locale}|${JSON.stringify(options)}`;
  let format = dates.get(key);
  if (!format) dates.set(key, (format = new Intl.DateTimeFormat(locale, options)));
  return format;
}

export function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = numbers.get(key);
  if (!format) numbers.set(key, (format = new Intl.NumberFormat(locale, options)));
  return format;
}
