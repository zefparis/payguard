const KEY = 'payguard-secure-collect-mode'

export function isSecureCollectMode(): boolean {
  return window.localStorage.getItem(KEY) === '1'
}

export function setSecureCollectMode(enabled: boolean): void {
  window.localStorage.setItem(KEY, enabled ? '1' : '0')
}
