// Images bundled with the window (src/app/assets): importing one gives its URL.
declare module "*.png" {
  const url: string;
  export default url;
}
