/** One install guide's words. */
interface Guide {
  title: string;
  steps: { title: string; body: string[] }[];
}

/** The website's words in one language (the shape the tests read). */
declare const words: {
  home: { faq: { items: { q: string; a: string }[] } };
  install: { guide: { signIn: { title: string } } };
  guides: Record<"android" | "iphone" | "windows" | "mac" | "linux", Guide>;
};
export default words;
