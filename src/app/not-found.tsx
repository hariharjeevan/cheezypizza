import { JSX } from 'react'
import ReturnHome from '../components/ReturnHome'

export const metadata = {
  title: 'CheezyPizza - 404: Slice Not Found',
  description: 'Oops! This slice of CheezyPizza seems to be missing.',
}

export default async function NotFound(): Promise<JSX.Element> {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 max-w-md mx-auto text-center gap-6">
      <p
        className="font-mono text-m tracking-widest uppercase"
        style={{ color: 'var(--pizza-text-muted)' }}
      >
        404
      </p>
      <h1
        className="font-serif italic text-3xl leading-snug"
        style={{ color: 'var(--pizza-text)' }}
      >
        This slice got eaten.
      </h1>
      <p className="text-sm" style={{ color: 'var(--pizza-text-muted)' }}>
        The link may have expired, or the sender already closed the tab. P2P
        transfers don&apos;t live forever.
      </p>
      <ReturnHome />
    </div>
  )
}
