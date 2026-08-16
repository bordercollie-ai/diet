import '@testing-library/svelte/vitest'

const storage = new Map<string, string>()
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() {
    return storage.size
  }
}

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true })
Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true })
Object.defineProperty(window, 'matchMedia', {
  value: () => ({ matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {} }),
  configurable: true
})

// jsdom doesn't implement the Pointer Capture API; bits-ui's Select trigger
// calls `hasPointerCapture`/`releasePointerCapture` on pointerdown to avoid
// implicit capture, which would otherwise throw in tests that open a Select.
if (typeof Element !== 'undefined' && !Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
}

// jsdom doesn't implement the Web Animations API; Svelte's `transition:fade`
// (used e.g. by the toast) calls `element.animate(...)`, which would otherwise
// throw an uncaught exception during/after any test that triggers it.
if (typeof Element !== 'undefined' && !Element.prototype.animate) {
  Element.prototype.animate = () =>
    ({
      finished: Promise.resolve(),
      cancel: () => {},
      play: () => {},
      pause: () => {},
      finish: () => {},
      addEventListener: () => {},
      removeEventListener: () => {}
    }) as unknown as Animation
}
