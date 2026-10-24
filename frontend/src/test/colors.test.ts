// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chartColors } from '../lib/colors.ts'

// Vitest doesn't load CSS files, so read the stylesheet as text.
const css = readFileSync(new URL('../styles/global.css', import.meta.url), 'utf8')
const darkBlock = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'))
const variables = Object.values(chartColors).map((value) => value.slice('var('.length, -1))

describe('chart colours', () => {
  it.each(variables)('%s is defined for light mode', (name) => {
    expect(css).toMatch(new RegExp(`${name}:\\s*#`))
  })

  it.each([
    '--series-forecast',
    '--series-actual',
    '--band',
    '--under-forecast',
    '--over-forecast',
  ])('%s has its own dark-mode value', (name) => {
    expect(darkBlock).toMatch(new RegExp(`${name}:\\s*#`))
  })
})
