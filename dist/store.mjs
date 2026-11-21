import { freshState, withWorkerName } from './core.mjs?v=11'

let opening
function openRegister() {
  if (opening) return opening
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open('registro-ore-lavoro', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('registro')
    request.onblocked = () => reject(new Error('Chiudi le altre schede del registro e ricarica.'))
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => {
        database.close()
        opening = null
      }
      resolve(database)
    }
  }).catch(error => {
    opening = null
    throw error
  })
  return opening
}

async function transact(change) {
  const database = await openRegister()
  return new Promise((resolve, reject) => {
    const tx = database.transaction('registro', change ? 'readwrite' : 'readonly')
    const store = tx.objectStore('registro')
    const request = store.get('dati')
    let state
    let failure
    request.onsuccess = () => {
      state = request.result ?? freshState()
      state.profile = withWorkerName(state.profile)
      if (!change) return
      try {
        change(state)
        state.revision++
        store.put(state, 'dati')
      } catch (error) {
        failure = error
        tx.abort()
      }
    }
    tx.oncomplete = () => resolve(state)
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('Il salvataggio è stato interrotto.'))
  })
}

export const readState = () => transact()
export const updateState = change => transact(change)
