import { Capacitor } from '@capacitor/core'

const PRIVACY_POLICY_URL = 'https://hybrid-vector.com/privacy'

/**
 * Opens the iOS Settings app for this app's permission settings.
 * On web, opens browser-level instructions in a new tab.
 */
export function openAppSettings(): void {
  if (Capacitor.isNativePlatform()) {
    // iOS deep link to app-specific settings page
    window.location.href = 'app-settings:'
  } else {
    // Web fallback — no programmatic access to browser settings
    // The user must enable manually
  }
}

/**
 * Opens the Privacy Policy in a new tab / system browser.
 */
export function openPrivacyPolicy(): void {
  window.open(PRIVACY_POLICY_URL, '_blank', 'noopener,noreferrer')
}

export { PRIVACY_POLICY_URL }
