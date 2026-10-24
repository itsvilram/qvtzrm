import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest doesn't expose test globals here, so unmount rendered components after each test ourselves.
afterEach(() => cleanup())

// jsdom has no ResizeObserver; Recharts' responsive charts need one to exist.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
