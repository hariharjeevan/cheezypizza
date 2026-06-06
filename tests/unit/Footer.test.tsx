/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Footer from '../../src/components/Footer'

Object.defineProperty(window, 'location', {
  value: { href: '' },
  writable: true,
})

describe('Footer', () => {
  it('renders the GitHub project link', () => {
    const { getByLabelText } = render(<Footer />)
    expect(getByLabelText('CheezyPizza on GitHub')).toBeInTheDocument()
  })
})
