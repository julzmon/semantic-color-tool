/// <reference types="vite/client" />
declare module 'virtual:kds-reference' {
  const reference: import('./engine/types').KdsReference;
  export default reference;
}
