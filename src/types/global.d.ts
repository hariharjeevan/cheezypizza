// Global type declarations for static asset imports
declare module '*.css'
declare module '*.scss'
declare module '*.module.css'
declare module '*.module.scss'

declare module '*.svg' {
  const content: string
  export default content
}

declare module '*.png' {
  const content: string
  export default content
}

declare module '*.jpg' {
  const content: string
  export default content
}

declare module '*.jpeg' {
  const content: string
  export default content
}

declare module '*.webp' {
  const content: string
  export default content
}

declare global {
  interface Window {
    showSaveFilePicker?: typeof window.showSaveFilePicker
  }
}

export {}
