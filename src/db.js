const DB_NAME = "vbt-lab"
const STORE = "sessions"

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function listSessions() {
  const db = await openDb()
  const rows = await requestToPromise(db.transaction(STORE).objectStore(STORE).getAll())
  db.close()
  return rows.sort((a, b) => String(b.sets[0]?.triedAt).localeCompare(String(a.sets[0]?.triedAt)))
}

export async function getSession(id) {
  const db = await openDb()
  const row = await requestToPromise(db.transaction(STORE).objectStore(STORE).get(id))
  db.close()
  return row ?? null
}

export async function putSession(session) {
  const db = await openDb()
  await requestToPromise(db.transaction(STORE, "readwrite").objectStore(STORE).put(session))
  db.close()
}

export async function deleteSession(id) {
  const db = await openDb()
  await requestToPromise(db.transaction(STORE, "readwrite").objectStore(STORE).delete(id))
  db.close()
}
