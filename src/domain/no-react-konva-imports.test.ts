/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Enforces the plan's core invariant: `src/domain/**` is pure TypeScript
 * with zero React/Konva/DOM imports, so it stays unit-testable in Node and
 * swappable from the canvas library. This is a real guard (scans the actual
 * source text), not just a reviewed convention - we cannot add an ESLint
 * `no-restricted-imports` rule here because this phase does not own
 * `eslint.config.js`.
 */

const domainDir = dirname(fileURLToPath(import.meta.url))
const FORBIDDEN_IMPORT_SOURCES = ['react', 'react-dom', 'react-konva', 'konva']
const importFromPattern = (source: string): RegExp =>
  new RegExp(`from\\s+['"]${source}(/[^'"]*)?['"]`)

function domainSourceFiles(): string[] {
  return readdirSync(domainDir).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
}

describe('src/domain purity guard', () => {
  const files = domainSourceFiles()

  it('contains the expected domain modules (guard did not silently find nothing)', () => {
    expect(files.length).toBeGreaterThanOrEqual(9)
  })

  it.each(files)('%s has no React/Konva/DOM import', (file: string) => {
    const content = readFileSync(join(domainDir, file), 'utf8')
    for (const source of FORBIDDEN_IMPORT_SOURCES) {
      expect(content).not.toMatch(importFromPattern(source))
    }
  })

  it.each(files)('%s is not a .tsx file (no JSX in the domain layer)', (file: string) => {
    expect(file.endsWith('.tsx')).toBe(false)
  })
})
