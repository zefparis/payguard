import { openDB, type IDBPDatabase } from 'idb'
import type { FlowState } from '../types/flow'

const DB_NAME = 'payguard'
const STORE_NAME = 'flow-state'
const STATE_KEY = 'current-flow'

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
  }
  return dbPromise
}

export async function saveFlowState(state: FlowState): Promise<void> {
  try {
    const db = await getDB()
    await db.put(STORE_NAME, state, STATE_KEY)
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[queue] save failed', err)
  }
}

export async function loadFlowState(): Promise<FlowState | null> {
  try {
    const db = await getDB()
    const state = await db.get(STORE_NAME, STATE_KEY)
    return (state as FlowState) ?? null
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[queue] load failed', err)
    return null
  }
}

export async function clearFlowState(): Promise<void> {
  try {
    const db = await getDB()
    await db.delete(STORE_NAME, STATE_KEY)
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[queue] clear failed', err)
  }
}
