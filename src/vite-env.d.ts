/// <reference types="vite/client" />

declare module "*.png" {
  const source: string;
  export default source;
}

declare module "*.PNG" {
  const source: string;
  export default source;
}
