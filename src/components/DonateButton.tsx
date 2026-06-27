import { JSX } from 'react'
import { GoHeartFill } from 'react-icons/go'

const DONATE_URL =
  'https://github.com/hariharjeevan/cheezypizza#webrtc-based-p2p-file-transfers-in-your-browser-'

export default function DonateButton(): JSX.Element {
  return (
    <a
      href={DONATE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Donate to CheezyPizza"
      className="
        w-9 h-9 flex items-center justify-center rounded-lg
        text-green-900 dark:text-green-300
        bg-green-100 dark:bg-green-950/60
        border border-green-300 dark:border-green-800
        hover:bg-green-200 dark:hover:bg-green-900/60
        hover:border-green-400 dark:hover:border-green-700
        transition-colors duration-200
      "
    >
      <GoHeartFill size={16} aria-hidden="true" />
    </a>
  )
}
