export const statuses = {
  lavoro: 'Lavoro', ferie: 'Ferie', malattia: 'Malattia',
  permesso: 'Permesso', riposo: 'Riposo', altro: 'Altro',
}
export const hoursFields = ['sede', 'fuori', 'viaggio']
export const durationLabels = { sede: 'Ore in sede', fuori: 'Ore fuori sede', viaggio: 'Ore di viaggio' }
export const minYear = 1900
export const maxYear = 9999
const maxMinutes = 9999 * 60 + 59
const maxMeters = 9_999_999_999
const dateFormat = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const monthFormat = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' })
const dayFormat = new Intl.DateTimeFormat('it-IT', { weekday: 'long' })
const kilometerFormat = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 3 })

export const limits = { nome: 80, cognome: 80, azienda: 120, base: 1200, luogo: 1200, note: 6000 }
export const pad = n => String(n).padStart(2, '0')
export const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1)
export const dateKey = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`
export function todayKey() {
  const now = new Date()
  return dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate())
}
export function dateFor(key) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}
export function monthCount(year, month) {
  return new Date(year, month, 0, 12).getDate()
}
export function isDateKey(key) {
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(key)) return false
  const [year, month, day] = key.split('-').map(Number)
  return year >= minYear && year <= maxYear && day <= monthCount(year, month)
}
export const labelDate = key => capitalize(dateFormat.format(dateFor(key)))
export const labelMonth = (year, month) => capitalize(monthFormat.format(new Date(year, month - 1, 1, 12)))
export const dayName = key => capitalize(dayFormat.format(dateFor(key)))
export const formatDate = key => key.split('-').reverse().join('/')
export const minutesText = value => `${Math.floor((value ?? 0) / 60)} h ${pad((value ?? 0) % 60)} min`
export const kilometersText = meters => kilometerFormat.format((meters ?? 0) / 1000)
export const fullName = profile => [profile.nome, profile.cognome].filter(Boolean).join(' ')
export const withWorkerName = profile => ({ ...profile, nome: 'Angelo', cognome: 'Argese' })
export const freshProfile = () => withWorkerName({ azienda: '', base: '', defaultSede: null, logo: '' })
export const emptyDay = () => ({ status: 'lavoro', sede: null, fuori: null, viaggio: null, meters: null, luogo: '', note: '' })
export const freshState = () => ({ revision: 0, profile: freshProfile(), settings: { theme: 'auto' }, entries: {} })

export function typicalDay(profile, day = emptyDay()) {
  return { ...day, status: 'lavoro', sede: profile.defaultSede, luogo: profile.base }
}
export function parseDuration(hours, minutes) {
  const h = String(hours).trim()
  const m = String(minutes).trim()
  if (!h && !m) return null
  if ((h && !/^\d{1,4}$/.test(h)) || (m && !/^\d{1,2}$/.test(m)) || Number(m) > 59) {
    throw new Error('Inserisci ore intere da 0 a 9999 e minuti da 0 a 59.')
  }
  return Number(h) * 60 + Number(m)
}
export function parseDistance(input) {
  const value = String(input).trim()
  if (!value) return null
  if (!/^(?:\d{1,7}(?:[.,]\d{1,3})?|[.,]\d{1,3})$/.test(value)) {
    throw new Error('Inserisci chilometri da 0 a 9999999,999, con al massimo tre decimali.')
  }
  const [whole, decimal = ''] = value.replace(',', '.').split('.')
  return Number(whole) * 1000 + Number(decimal.padEnd(3, '0'))
}
export function monthRows(state, year, month) {
  return Array.from({ length: monthCount(year, month) }, (_, index) => {
    const key = dateKey(year, month, index + 1)
    return { key, weekday: dayName(key), entry: state.entries[key] ?? null }
  })
}
export function summarize(rows) {
  const total = { sede: 0, fuori: 0, viaggio: 0, meters: 0, hours: 0, filled: 0,
    counts: Object.fromEntries(Object.keys(statuses).map(key => [key, 0])) }
  for (const { entry } of rows) {
    if (!entry) continue
    total.filled++
    total.counts[entry.status]++
    for (const key of hoursFields) total[key] += entry[key] ?? 0
    total.meters += entry.meters ?? 0
  }
  total.hours = total.sede + total.fuori + total.viaggio
  return total
}

export const usableText = value =>
  value.toWellFormed ? value.toWellFormed().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '\ufffd') :
    new TextDecoder().decode(new TextEncoder().encode(value)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '\ufffd')

const boundedText = (value, length) => typeof value === 'string' && value.length <= length && value === usableText(value)
const nullableInt = (value, max) => value === null || (Number.isInteger(value) && value >= 0 && value <= max)
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
export const logoValid = value => value === '' || (
  typeof value === 'string' && value.length <= 1_100_000 &&
  /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(value)
)
export function makeBackup(state, now = new Date()) {
  return { format: 'registro-ore-lavoro', version: 1, createdAt: now.toISOString(),
    profile: withWorkerName(state.profile), settings: state.settings, entries: state.entries }
}
export function parseBackup(text) {
  let input
  try { input = JSON.parse(text) }
  catch { throw new Error('Il file non contiene un backup JSON leggibile.') }
  if (!record(input) || input.format !== 'registro-ore-lavoro' || input.version !== 1) {
    throw new Error('Il formato o la versione del backup non sono riconosciuti.')
  }
  const { profile, settings, entries } = input
  if (!record(profile) || !record(entries) || !record(settings) || !['auto', 'light', 'dark'].includes(settings.theme)) {
    throw new Error('Nel backup mancano il profilo, le impostazioni o il registro.')
  }
  for (const key of ['nome', 'cognome', 'azienda', 'base']) {
    if (!boundedText(profile[key], limits[key])) throw new Error('I dati del profilo nel backup non sono validi.')
  }
  if (!nullableInt(profile.defaultSede, maxMinutes) || !logoValid(profile.logo)) {
    throw new Error('La giornata tipo o il logo nel backup non sono validi.')
  }
  const clean = {}
  for (const [key, day] of Object.entries(entries)) {
    if (!isDateKey(key) || !record(day) || !Object.prototype.hasOwnProperty.call(statuses, day.status) ||
      !hoursFields.every(field => nullableInt(day[field], maxMinutes)) || !nullableInt(day.meters, maxMeters) ||
      !boundedText(day.note, limits.note) || !boundedText(day.luogo, limits.luogo)) {
      throw new Error(`Il backup contiene una registrazione non valida (${key.slice(0, 30)}).`)
    }
    clean[key] = { status: day.status, sede: day.sede, fuori: day.fuori, viaggio: day.viaggio,
      meters: day.meters, luogo: day.luogo, note: day.note }
  }
  const { azienda, base, defaultSede, logo } = profile
  return { profile: withWorkerName({ azienda, base, defaultSede, logo }), settings: { theme: settings.theme }, entries: clean }
}
