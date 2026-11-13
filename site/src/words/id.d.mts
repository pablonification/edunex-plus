/** One install guide's words. */
interface Guide {
  title: string;
  steps: { title: string; body: string[] }[];
}

/** The website's words in one language (the shape the tests read). */
declare const words: {
  home: { hero: { title: string[] }; faq: { items: { q: string; a: string }[] }; screens: { items: { q: string; a: string; alt: string }[] } };
  install: { guide: { signIn: { title: string } } };
  guides: Record<"android" | "iphone" | "windows" | "mac" | "linux", Guide>;
};
export default words;
