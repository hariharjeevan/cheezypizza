/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Footer from '../../src/components/Footer'

vi.mock('../../src/components/SplitText', () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}))

beforeEach(() => {
  Object.defineProperty(window, 'location', { value: { href: '' }, writable: true })
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
})

describe('Footer', () => {
  it('renders the GitHub project link pointing to the correct repo', () => {
    const { getByLabelText } = render(<Footer />)
    const link = getByLabelText('CheezyPizza on GitHub')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', 'https://github.com/hariharjeevan/cheezypizza')
  })
})