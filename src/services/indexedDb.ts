type StoreName = 'sessions'

export type SecureSessionRecord = {
  session_id: string
  tenant_id: string
  created_at: string
  state: 'INIT' | 'COLLECTE' | 'UPLOAD' | 'TERMINE'
  identity?: {
    first_name: string
    last_name: string
    employee_id?: string
    job_role?: string
    employer_site?: string
    email?: string
  }
  selfie_b64?: string
  audio_samples_f32?: number[]
  cognitive_baseline?: Record<string, unknown>
  behavioral_profile?: unknown
}

const DB_NAME = 'payguard'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'session_id' })
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
}

function tx<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode)
    const store = t.objectStore(storeName)
    const req = fn(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
    t.oncomplete = () => db.close()
    t.onabort = () => db.close()
    t.onerror = () => db.close()
  }))
}

export async function idbGetSession(session_id: string): Promise<SecureSessionRecord | undefined> {
  const res = await tx<SecureSessionRecord | undefined>('sessions', 'readonly', store => store.get(session_id))
  return res
}

export async function idbUpsertSession(record: SecureSessionRecord): Promise<void> {
  await tx('sessions', 'readwrite', store => store.put(record))
}

export async function idbPatchSession(session_id: string, patch: Partial<SecureSessionRecord>): Promise<SecureSessionRecord> {
  const current = (await idbGetSession(session_id))
  if (!current) throw new Error('Session not found in IndexedDB')
  const next: SecureSessionRecord = { ...current, ...patch }
  await idbUpsertSession(next)
  return next
}

export async function idbDeleteSession(session_id: string): Promise<void> {
  await tx('sessions', 'readwrite', store => store.delete(session_id))
}
