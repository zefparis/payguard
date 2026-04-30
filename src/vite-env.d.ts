/// <reference types="vite/client" />

declare module '*.css' {
  const content: string
  export default content
}

declare module 'react-dom/client' {
  import { ReactNode } from 'react'
  interface Root {
    render(children: ReactNode): void
    unmount(): void
  }
  interface RootOptions {
    onRecoverableError?: (error: unknown) => void
    identifierPrefix?: string
  }
  export function createRoot(container: Element | DocumentFragment, options?: RootOptions): Root
  export function hydrateRoot(container: Element | Document, initialChildren: ReactNode, options?: RootOptions): Root
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_HV_API_KEY: string
  readonly VITE_TENANT_ID: string
  readonly VITE_PAYMENT_THRESHOLD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
