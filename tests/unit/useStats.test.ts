import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { shouldSkipStatsPing } from '../../src/hooks/useStats'

describe('useStats ping dedupe', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it('skips ping when the current browser session already pinged today', () => {
    const today = new Date().toISOString().slice(0, 10)
    sessionStorage.setItem(`stats:pinged:${today}`, '1')

    expect(shouldSkipStatsPing()).toBe(true)
  })

  it('allows ping when the session has not pinged today', () => {
    const today = new Date().toISOString().slice(0, 10)
    sessionStorage.setItem(`stats:pinged:${new Date(Date.now() - 86400000).toISOString().slice(0, 10)}`, '1')

    expect(shouldSkipStatsPing()).toBe(false)
  })
})
