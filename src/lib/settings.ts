import { Capacitor } from '@capacitor/core'

const PRIVACY_POLICY_URL = 'https://hybrid-vector.com/privacy'

export function openAppSettings(): void {
  if (Capacitor.isNativePlatform()) {
    const platform = Capacitor.getPlatform()
    if (platform === 'ios') {
      window.location.href = 'app-settings:'
    } else if (platform === 'android') {
      window.location.href = 'package:com.iasolution.payguard'
    }
  }
}

/**
 * Opens the Privacy Policy in a new tab / system browser.
 */
export function openPrivacyPolicy(): void {
  window.open(PRIVACY_POLICY_URL, '_blank', 'noopener,noreferrer')
}

export { PRIVACY_POLICY_URL }
