// Images bundled with the window (src/app/assets): importing one gives its URL.
declare module "*.png" {
  const url: string;
  export default url;
}

// Files bundled as they are (the PDF viewer's worker): importing one with ?url gives its URL.
declare module "*?url" {
  const url: string;
  export default url;
}
