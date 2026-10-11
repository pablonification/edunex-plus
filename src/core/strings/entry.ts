// One catalog entry: Indonesian and English. English entries that depend on a
// count give "one" and "other" forms.
export type Forms = { one: string; other: string };
export type Entry = { id: string; en: string | Forms };
