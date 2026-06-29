/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import DropZone from '../../src/components/DropZone'

function createFile(name: string) {
  return new File(['hello'], name, { type: 'text/plain' })
}

describe('DropZone', () => {
  it('calls onDropAction with the selected files', () => {
    const fn = vi.fn()
    const { container } = render(<DropZone onDropAction={fn} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = createFile('a.txt')
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    input.dispatchEvent(new Event('change', { bubbles: true }))

    expect(fn).toHaveBeenCalledOnce()
    expect(fn).toHaveBeenCalledWith([file])
  })
})