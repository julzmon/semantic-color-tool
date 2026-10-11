/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
declare module 'virtual:kds-reference' {
  const reference: import('./engine/types').KdsReference;
  export default reference;
}
