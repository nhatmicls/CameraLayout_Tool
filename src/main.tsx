import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const maybeRootElement = document.getElementById('root')
if (!maybeRootElement) {
  throw new Error('Root element "#root" not found in index.html')
}
// Re-bound to a plain non-null const: TS does not retain the null-check
// narrowing above across the closures below (they could in principle run
// much later), so a second, never-reassigned binding keeps them typed.
const rootElement: HTMLElement = maybeRootElement

/** Renders a plain-DOM error screen (no React - React may never have mounted). */
function renderBlockingError(message: string): void {
  rootElement.innerHTML = ''
  const container = document.createElement('div')
  container.style.cssText = 'max-width: 640px; margin: 10vh auto; padding: 24px; font-family: system-ui, sans-serif; color: #991b1b;'
  const heading = document.createElement('h1')
  heading.style.cssText = 'font-size: 18px; margin: 0 0 12px;'
  heading.textContent = 'Camera catalog failed to validate'
  const pre = document.createElement('pre')
  pre.style.cssText =
    'white-space: pre-wrap; font-size: 13px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px;'
  pre.textContent = message
  container.append(heading, pre)
  rootElement.appendChild(container)
}

/**
 * `./app` is imported dynamically (not as a static top-level import) so a
 * catalog validation failure - thrown at module-evaluation time by
 * `src/catalog/camera/camera-catalog-loader.ts` when a brand JSON file fails its
 * Zod schema - surfaces as a readable blocking screen instead of a blank
 * page. A static `import { App } from './app'` would throw before any of
 * this file's own code (including a try/catch around `render`) ever runs,
 * since static imports are evaluated before the importing module's body.
 */
import('./app')
  .then(({ App }) => {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((err: unknown) => {
    renderBlockingError(err instanceof Error ? err.message : String(err))
  })
