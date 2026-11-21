import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyDay, freshState, isDateKey, makeBackup, monthRows, parseBackup, parseDuration,
  parseDistance, summarize, typicalDay, minutesText, kilometersText, fullName, withWorkerName,
} from '../dist/core.mjs'

test('calendario gregoriano, febbraio e limiti degli anni', () => {
  const state = freshState()
  for (const [year, month, total] of [[2024, 2, 29], [2025, 2, 28], [1900, 2, 28], [2000, 2, 29], [2026, 11, 30], [2026, 12, 31], [9999, 12, 31]]) {
    assert.equal(monthRows(state, year, month).length, total)
  }
  assert.equal(monthRows(state, 2024, 2).at(-1).weekday, 'Giovedì')
  for (const key of ['2025-02-29','2026-04-31','2026-13-04','2026-11-00','1899-12-31','2026-2-01','__proto__']) {
    assert.equal(isDateKey(key), false)
  }
  assert.equal(isDateKey('2024-02-29'), true)
})

test('durate in minuti, inclusi zero e campi vuoti', () => {
  assert.equal(parseDuration('', ''), null)
  assert.equal(parseDuration('0', ''), 0)
  assert.equal(parseDuration('', '5'), 5)
  assert.equal(parseDuration('8', '30'), 510)
  assert.equal(minutesText(1505), '25 h 05 min')
  for (const values of [['-1','0'], ['1.5','0'], ['8','60'], ['1','-1'], ['8','x'], ['10000','0']]) {
    assert.throws(() => parseDuration(...values))
  }
})

test('distanze in metri interi, punto e virgola decimali', () => {
  assert.equal(parseDistance(''), null)
  assert.equal(parseDistance('0'), 0)
  assert.equal(parseDistance('12,375'), 12375)
  assert.equal(parseDistance('.25'), 250)
  assert.equal(parseDistance('0.001') + parseDistance('0.002'), 3)
  assert.equal(kilometersText(12375), '12,375')
  for (const value of ['-1','1e3','1..1','1,0001','Infinity','1.234,50','10000000']) {
    assert.throws(() => parseDistance(value))
  }
})

test('totali per tutte le categorie e note di assenza senza ore implicite', () => {
  const state = freshState()
  state.entries = {
    '2024-02-01': { ...emptyDay(), sede: 510, fuori: 75, viaggio: 45, meters: 12375, note: '=1+1' },
    '2024-02-02': { ...emptyDay(), status: 'ferie', note: 'Nota su ferie' },
    '2024-02-03': { ...emptyDay(), status: 'malattia' },
    '2024-02-04': { ...emptyDay(), status: 'riposo' },
    '2024-02-05': { ...emptyDay(), status: 'permesso', sede: 60 },
    '2024-02-29': { ...emptyDay(), status: 'altro', meters: 5 },
    '2024-03-01': { ...emptyDay(), sede: 13 },
  }
  assert.deepEqual(summarize(monthRows(state, 2024, 2)), {
    sede: 570, fuori: 75, viaggio: 45, meters: 12380, hours: 690, filled: 6,
    counts: { lavoro: 1, ferie: 1, malattia: 1, permesso: 1, riposo: 1, altro: 1 },
  })
})

test('giornata tipo e backup con dati di mesi diversi, testi lunghi e impostazioni', () => {
  const state = freshState()
  state.profile.defaultSede = 510
  state.profile.base = 'Officina'
  state.settings.theme = 'dark'
  state.entries['2024-02-02'] = typicalDay(state.profile)
  state.entries['2024-03-04'] = { ...emptyDay(), note: 'à è \n'.repeat(900), luogo: '=OFFICINA' }
  const imported = parseBackup(JSON.stringify(makeBackup(state)))
  const { revision, ...data } = state
  assert.deepEqual(imported, data)
  assert.equal(imported.entries['2024-02-02'].sede, 510)
  assert.equal(imported.entries['2024-02-02'].luogo, 'Officina')
})

test('un backup con campi mancanti, date o valori invalidi viene rifiutato', () => {
  const candidate = makeBackup(freshState())
  for (const invalid of [
    { ...candidate, version: 2 },
    { ...candidate, profile: { ...candidate.profile, defaultSede: -1 } },
    { ...candidate, profile: { ...candidate.profile, logo: 'http://example.invalid/logo.png' } },
    { ...candidate, entries: { '2024-02-30': emptyDay() } },
    { ...candidate, entries: { '2024-02-29': { ...emptyDay(), status: 'constructor' } } },
    { ...candidate, entries: { '2024-02-29': { ...emptyDay(), meters: 3.5 } } },
    { ...candidate, entries: { '2024-02-29': { ...emptyDay(), note: 'x'.repeat(6001) } } },
    { ...candidate, settings: { theme: 'contrasto' } },
  ]) assert.throws(() => parseBackup(JSON.stringify(invalid)))
  assert.throws(() => parseBackup('not a json'))
})

test('il profilo unico viene usato anche per archivi e backup precedenti', () => {
  const state = freshState()
  assert.equal(fullName(state.profile), 'Angelo Argese')
  const legacyProfile = { ...state.profile, nome: 'Mario', cognome: 'Rossi', base: 'Officina', defaultSede: 480 }
  state.profile = legacyProfile
  state.entries['2026-11-20'] = { ...emptyDay(), sede: 510 }
  assert.equal(fullName(makeBackup(state).profile), 'Angelo Argese')
  const oldBackup = { ...makeBackup(state), profile: legacyProfile }
  const restored = parseBackup(JSON.stringify(oldBackup))
  assert.equal(fullName(restored.profile), 'Angelo Argese')
  assert.equal(restored.profile.base, 'Officina')
  assert.equal(restored.profile.defaultSede, 480)
  assert.deepEqual(restored.entries, state.entries)
  assert.deepEqual(withWorkerName(legacyProfile), restored.profile)
})
