'use client'

import { useEffect, useState } from 'react'

export type DevicePlatform = 'cheezypizza' | 'web'
export type DeviceType = 'mobile' | 'tablet' | 'desktop'

export interface DeviceInfo {
  browser: string
  os: string
  deviceType: DeviceType
  platform: DevicePlatform
}

function detectBrowser(ua: string): string {
  if (/EdgA?\/|Edg\//i.test(ua)) return 'Edge'
  if (/OPR\/|Opera\//i.test(ua)) return 'Opera'
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet'
  if (/Firefox\/|FxiOS\//i.test(ua)) return 'Firefox'
  if (/CriOS\//i.test(ua)) return 'Chrome'
  if (/Chrome\/[0-9]/i.test(ua)) return 'Chrome'
  if (/Safari\//i.test(ua) && /Version\//i.test(ua)) return 'Safari'
  if (/MSIE |Trident\//i.test(ua)) return 'IE'
  return 'Browser'
}

function detectOS(ua: string): string {
  if (/Windows NT/i.test(ua)) return 'Windows'
  if (/Android/i.test(ua)) return 'Android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Mac OS X/i.test(ua)) return 'macOS'
  if (/Linux/i.test(ua)) return 'Linux'
  if (/CrOS/i.test(ua)) return 'ChromeOS'
  return 'Unknown OS'
}

export function detectDeviceType(ua: string): DeviceType {
  if (/iPad/i.test(ua)) return 'tablet'
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return 'tablet'
  if (/Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua))
    return 'mobile'
  return 'desktop'
}

function detectPlatform(ua: string): DevicePlatform {
  if (/CheezyPizza/i.test(ua)) return 'cheezypizza'
  return 'web'
}

export function getDeviceInfo(ua: string): DeviceInfo {
  return {
    browser: detectBrowser(ua),
    os: detectOS(ua),
    deviceType: detectDeviceType(ua),
    platform: detectPlatform(ua),
  }
}

const UNKNOWN: DeviceInfo = {
  browser: '…',
  os: '…',
  deviceType: 'desktop',
  platform: 'web',
}

export function useDeviceInfo(): DeviceInfo {
  const [info, setInfo] = useState<DeviceInfo>(UNKNOWN)
  useEffect(() => {
    setInfo(getDeviceInfo(navigator.userAgent))
  }, [])
  return info
}
