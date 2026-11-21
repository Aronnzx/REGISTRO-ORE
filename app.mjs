import {
  statuses, hoursFields, durationLabels, minYear, maxYear, limits, todayKey, dateKey, dateFor,
  labelDate, labelMonth, minutesText, kilometersText, fullName, pad, isDateKey, emptyDay,
  typicalDay, parseDuration, parseDistance, monthRows, summarize, freshState, makeBackup, parseBackup, usableText,
} from './core.mjs?v=11'
import { readState, updateState } from './store.mjs?v=11'
import { pdfReport, renderPaper, xlsxReport } from './reports.mjs?v=11'

const paths = {
  home: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21v-7h6v7"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 5h2m4 0h2"/>',
  export: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  profile: '<circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2"/>',
  left: '<path d="m14.5 6-6 6 6 6"/>', right: '<path d="m9.5 6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pin: '<path d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  truck: '<path d="M3 5h11v12H3zm11 4h4l3 4v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zm0 0v6h6M8 13h8m-8 4h6"/>',
  sheet: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18m-18 5h18m-12-5v11m6-11v11"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  bolt: '<path d="m13 2-8 12h6l-1 8 9-12h-6z"/>',
  check: '<path d="m5 12 4 4L19 6"/>', box: '<path d="M4 7h16v14H4zM3 3h18v4H3zm6 9h6"/>',
  share: '<path d="M12 15V3m-4 4 4-4 4 4M8 11H5v10h14V11h-3"/>',
}
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`
const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
const $ = id => document.getElementById(id)
const content = $('content')
const editor = $('editor')
const modal = $('modal')
const views = { home: ['Home', 'Panoramica'], calendar: ['Calendario', 'Calendario'], export: ['Esporta', 'Esporta'], profile: ['Profilo', 'Profilo e impostazioni'] }
const button = (action, title, kind = 'secondary', glyph = '', extra = '') => `<button type="button" class="${kind}" data-action="${action}" ${extra}>${glyph ? icon(glyph) : ''}${title}</button>`
const iconButton = (action, name, title, extra = '') => `<button class="icon-button" type="button" data-action="${action}" aria-label="${title}" title="${title}" ${extra}>${icon(name)}</button>`
const heading = (title, subtitle = '', tool = '') => `<div class="view-heading"><div><h1>${title}</h1>${subtitle ? `<p class="view-subtitle">${subtitle}</p>` : ''}</div>${tool}</div>`

let state = freshState()
let ready = false
let loadError = false
let activeView
let year = Number(todayKey().slice(0, 4))
let month = Number(todayKey().slice(5, 7))
let bulk = false
const selected = new Set()
let dayEdit = null
let modalHandler = null
let noticeTimer
let pending = 0
let editBusy = false
let quickSaveBusy = false
let profileQueue = Promise.resolve()
let previewToken = 0
let imageBusy = false
let queuedProfile = 0
const prepared = new Map()
let broadcasts
try { broadcasts = new BroadcastChannel('registro-ore-lavoro') } catch {}

function saveStatus(type, label, shortLabel = label) {
  const element = $('save-status')
  element.dataset.status = type
  element.title = label
  element.textContent = shortLabel
}
function notify(message) {
  const element = $('toast')
  window.clearTimeout(noticeTimer)
  element.textContent = message
  element.hidden = false
  noticeTimer = window.setTimeout(() => { element.hidden = true }, 3600)
}
function showError(element, message) {
  element.textContent = message
  element.hidden = !message
}
function renderChrome() {
  const nav = $('navigation')
  if (nav.dataset.active !== activeView) {
    nav.dataset.active = activeView
    nav.innerHTML = Object.entries(views).map(([key, [label]]) => `<a class="nav-link" href="#${key}"${key === activeView ? ' aria-current="page"' : ''}>${icon(key)}${label}</a>`).join('')
  }
  $('header-location').textContent = views[activeView][1]
  const name = fullName(state.profile)
  const profile = $('rail-profile')
  profile.innerHTML = `<a class="rail-profile" href="#profile"><span class="avatar">${icon('profile')}</span><span>${escape(name)}<small>Dati sul dispositivo</small></span></a>`
  document.documentElement.dataset.theme = state.settings.theme
  const dark = state.settings.theme === 'dark' || (state.settings.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name="theme-color"]').content = dark ? '#20364d' : '#f3f6fb'
}
function revoke(type) {
  const old = prepared.get(type)
  if (old) URL.revokeObjectURL(old.url)
  prepared.delete(type)
}
function storeFile(type, filename, mime, body) {
  revoke(type)
  const file = new File([body], filename, { type: mime })
  const item = { file, url: URL.createObjectURL(file) }
  prepared.set(type, item)
  return item
}
function invalidateReports() {
  previewToken++
  revoke('pdf')
  revoke('xlsx')
  revoke('backup')
}
function currentReport() {
  const rows = monthRows(state, year, month)
  return { rows, total: summarize(rows), profile: state.profile, year, month }
}
function periodPicker() {
  return `<div class="month-picker" aria-label="Periodo selezionato">
    ${iconButton('prev', 'left', 'Mese precedente', year === minYear && month === 1 ? 'disabled' : '')}
    <button type="button" class="period" data-action="period" aria-label="Scegli mese e anno. ${labelMonth(year, month)}">${icon('calendar')}${labelMonth(year, month)}</button>
    ${iconButton('next', 'right', 'Mese successivo', year === maxYear && month === 12 ? 'disabled' : '')}
  </div>`
}
const durationHtml = value => `${Math.floor(value / 60)} <small>h</small> ${pad(value % 60)} <small>min</small>`
function dayList(rows) {
  const filled = rows.filter(row => row.entry).reverse()
  if (!filled.length) return '<p class="empty-state">Nessuna giornata registrata per questo mese.</p>'
  return `<div class="day-list">${filled.map(({ key, weekday, entry }) => {
    const sum = hoursFields.reduce((acc, field) => acc + (entry[field] ?? 0), 0)
    return `<button type="button" class="day-card" data-action="day" data-day="${key}" aria-label="${labelDate(key)}, ${statuses[entry.status]}">
      <span class="day-num">${key.slice(-2)}</span><span class="day-copy"><span>${weekday}</span><small>${escape([statuses[entry.status], entry.luogo].filter(Boolean).join(' · '))}</small></span>
      <span class="day-duration">${minutesText(sum)}</span></button>`
  }).join('')}</div>`
}
function renderHome() {
  const { total } = currentReport()
  const today = todayKey()
  const todayEntry = state.entries[today]
  const showTypical = !todayEntry && hasTypical(state.profile)
  const todayMinutes = todayEntry ? hoursFields.reduce((sum, field) => sum + (todayEntry[field] ?? 0), 0) : 0
  const totals = [
    ['In sede', minutesText(total.sede)],
    ['Fuori sede', minutesText(total.fuori)],
    ['Viaggio', minutesText(total.viaggio)],
    ['Chilometri', `${kilometersText(total.meters)} km`],
    ...Object.entries(statuses).filter(([key]) => key !== 'lavoro' && total.counts[key] > 0)
      .map(([key, label]) => [label, total.counts[key]]),
  ]
  return `<div class="home-stack">
    <section class="panel today-panel" aria-labelledby="today-heading">
      <div class="today-intro">
        <h1 id="today-heading">Oggi</h1>
        <p class="section-note">${labelDate(today)}</p>
      </div>
      <div class="today-actions">
        ${todayEntry ? `<p class="today-record">${icon('check')} <span>${statuses[todayEntry.status]}${todayMinutes ? ` · ${minutesText(todayMinutes)}` : ''}</span></p>` : ''}
        ${showTypical ? `<p class="today-preset" id="quick-typical-summary">${escape(typicalSummary(state.profile))}</p>
          ${button('quick-typical', 'Salva giornata tipo', 'primary', 'bolt', `data-day="${today}" aria-describedby="quick-typical-summary"`)}
          ${button('today', 'Compila a mano', 'secondary')}` :
          button('today', todayEntry ? 'Modifica oggi' : 'Registra oggi', 'primary', todayEntry ? 'calendar' : 'plus')}
      </div>
    </section>
    <section class="panel month-summary" aria-labelledby="month-heading">
      <div class="month-summary-head">
        <h2 id="month-heading">${labelMonth(year, month)}</h2>
        ${iconButton('period', 'calendar', 'Scegli mese e anno')}
      </div>
      <div class="month-total">
        <p>Ore totali</p>
        <strong>${durationHtml(total.hours)}</strong>
        <p>${total.counts.lavoro} ${total.counts.lavoro === 1 ? 'giornata lavorata' : 'giornate lavorate'}</p>
      </div>
      <details class="month-details">
        <summary>Dettaglio del mese ${icon('right')}</summary>
        <dl>${totals.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>
      </details>
    </section>
  </div>`
}
function renderCalendar() {
  const { rows, total } = currentReport()
  const offset = (dateFor(rows[0].key).getDay() + 6) % 7
  const weekdays = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom']
  const today = todayKey()
  return `${heading('Calendario', 'Tocca un giorno per aprire la sua scheda.', periodPicker())}
    <div class="stack">
      <section class="panel calendar-panel">
        <div class="calendar-controls"><h2>${total.filled} di ${rows.length} compilati</h2>${button('bulk-toggle', bulk ? 'Esci dalla selezione' : 'Seleziona più giorni', 'quiet', bulk ? 'close' : 'check')}</div>
        <div class="calendar-grid">${weekdays.map(label => `<span class="weekday">${label}</span>`).join('')}${'<span aria-hidden="true"></span>'.repeat(offset)}
        ${rows.map(({ key, entry }) => {
          const label = `${labelDate(key)}, ${entry ? statuses[entry.status] : 'Non compilato'}`
          return `<button type="button" class="day" data-action="${bulk ? 'bulk-day' : 'day'}" data-day="${key}" data-day-status="${entry ? entry.status === 'lavoro' ? 'lavoro' : 'absence' : 'empty'}"
            aria-label="${label}" ${key === today ? 'aria-current="date"' : ''} ${bulk ? `aria-pressed="${selected.has(key)}"` : ''}>${Number(key.slice(-2))}<span class="dot" aria-hidden="true"></span></button>`
        }).join('')}</div>
        <div class="legend"><span><i class="today"></i> Oggi</span><span><i class="work"></i> Lavoro</span><span><i class="absence"></i> Assenza / altro</span><span><i></i> Da compilare</span></div>
        ${bulk ? `<div class="bulk-controls"><p aria-live="polite">${selected.size} ${selected.size === 1 ? 'giorno selezionato' : 'giorni selezionati'}. Anche i fine settimana si selezionano a mano.</p>
          ${button('bulk-apply', 'Applica giornata tipo', 'primary', 'bolt', selected.size ? '' : 'disabled')}
          ${button('bulk-clear', 'Deseleziona tutti', 'quiet', '', selected.size ? '' : 'disabled')}</div>` : ''}
      </section>
      <section class="panel"><div class="panel-title"><h2>Giornate registrate</h2></div>${dayList(rows)}</section>
    </div>`
}
function renderExports() {
  return `${heading('Esporta il mese', 'Controlla il foglio mensile prima di inviarlo.', periodPicker())}
    <div class="stack">
      <div class="action-grid">
        <section class="action-tile"><span class="glyph">${icon('file')}</span><h2>Foglio PDF</h2><p>Modulo mensile A4 con i dati del registro.</p>
          ${button('preview', 'Apri anteprima PDF', 'primary', 'file')}<div class="button-row" id="pdf-file" hidden></div></section>
        <section class="action-tile"><span class="glyph">${icon('sheet')}</span><h2>Foglio Excel</h2><p>File .xlsx per Excel, Numbers e programmi compatibili.</p>
          ${button('excel', 'Prepara Excel', 'secondary', 'sheet')}<div class="button-row" id="xlsx-file" hidden></div></section>
      </div>
      <section class="panel" id="preview-section" hidden><h2 id="preview-title" tabindex="-1">Anteprima PDF</h2><p id="preview-description" class="section-note" role="status"></p><div id="paper-area" class="paper-area" hidden></div><div class="button-row" id="pdf-file-bottom" hidden></div></section>
    </div>`
}
function fieldsTime(id, label, value) {
  const h = value == null ? '' : Math.floor(value / 60)
  const m = value == null ? '' : pad(value % 60)
  return `<fieldset class="time-block"><legend>${label}</legend><div class="time-units">
    <label><input name="${id}-h" aria-label="${label}, ore" type="text" inputmode="numeric" enterkeyhint="next" placeholder="0" value="${h}"><span aria-hidden="true">h</span></label>
    <label><input name="${id}-m" aria-label="${label}, minuti" type="text" inputmode="numeric" enterkeyhint="next" placeholder="00" value="${m}"><span aria-hidden="true">min</span></label>
  </div></fieldset>`
}
const textField = (id, label, value, attrs = '') => `<div class="field"><label for="${id}">${label}</label><input id="${id}" name="${id}" maxlength="${limits[id] ?? 1200}" value="${escape(value)}" ${attrs}></div>`
function logoMarkup(logo) {
  return logo ? `<span class="logo-box"><img alt="Logo aziendale caricato" src="${escape(logo)}"></span>${button('remove-logo', 'Rimuovi logo', 'quiet')}` : ''
}
function renderProfile() {
  const { profile, settings } = state
  const themes = { auto: 'Come il dispositivo', light: 'Chiaro', dark: 'Scuro' }
  return `${heading('Profilo e impostazioni')}
    <div class="stack">
      <section class="panel"><div class="panel-title"><h2>${escape(fullName(profile))}</h2></div>
        <form id="profile-form" class="field-stack" autocomplete="off" novalidate>
          ${textField('azienda','Azienda (facoltativa)',profile.azienda,'autocomplete="organization"')}
          <div class="field"><label for="logo">Logo aziendale (facoltativo)</label><div class="logo-row" id="logo-preview">${logoMarkup(profile.logo)}</div>
            <input type="file" id="logo" accept="image/png,image/jpeg,image/webp"><p class="help">PNG, JPEG o WebP, fino a 12 MB.</p></div>
          <h3>Giornata tipo</h3>${textField('base','Luogo abituale',profile.base,'placeholder="Es. Officina"')}
          ${fieldsTime('defaultSede','Ore in sede predefinite',profile.defaultSede)}
          <p id="profile-error" class="form-error" role="alert" hidden></p>
        </form>
      </section>
      <section class="panel"><div class="panel-title"><h2>Aspetto</h2></div><div class="field"><label for="theme">Tema dell’app</label><select id="theme">${Object.entries(themes).map(([key,label]) => `<option value="${key}"${settings.theme === key ? ' selected' : ''}>${label}</option>`).join('')}</select></div></section>
      <section class="panel stack"><h2>Backup e ripristino</h2>
        <p class="help">I dati restano sul dispositivo. Safari e l’app nella Home possono usare archivi separati, e i due iPhone non si sincronizzano. La cancellazione dei dati del browser può eliminare il registro.</p>
        <div class="button-row">${button('backup', 'Prepara backup', 'secondary', 'box')}${button('import', 'Importa backup', 'quiet')}</div>
        <div class="button-row" id="backup-file" hidden></div>
        <input type="file" id="import-file" accept=".json,application/json" hidden>
        <p class="help">Il backup contiene tutti i mesi, il profilo, il logo e le impostazioni. Chi ha il file può leggere i dati.</p>
        <p id="backup-error" class="form-error" role="alert" hidden></p>
      </section>
      <section class="panel"><h2>Uso su iPhone</h2><p class="section-note">In Safari, apri il menu di condivisione e scegli Aggiungi alla schermata Home. Apri da quell’icona prima di iniziare a compilare. Serve Internet per il primo accesso e gli aggiornamenti. Dopo il primo caricamento, il registro può funzionare anche offline finché rimane disponibile sul dispositivo.</p></section>
    </div>`
}
function render() {
  renderChrome()
  if (!ready) {
    content.innerHTML = loadError ?
      `<h1>Registro non disponibile</h1><p class="section-note">Impossibile aprire l’archivio sul dispositivo.</p>${button('reload', 'Ricarica', 'primary')}` :
      '<p class="loading">Apertura del registro…</p>'
    return
  }
  content.innerHTML = { home: renderHome, calendar: renderCalendar, export: renderExports, profile: renderProfile }[activeView]()
}

function showPeriod(nextYear, nextMonth) {
  if (nextYear < minYear || nextYear > maxYear) return
  year = nextYear
  month = nextMonth
  selected.clear()
  invalidateReports()
  render()
}
function changeMonth(increment) {
  const date = new Date(year, month - 1 + increment, 1, 12)
  showPeriod(date.getFullYear(), date.getMonth() + 1)
  content.querySelector(`[data-action="${increment < 0 ? 'prev' : 'next'}"]`)?.focus({ preventScroll: true })
}
function route() {
  const key = location.hash.slice(1)
  if (key === 'content' && activeView) return
  const next = Object.hasOwn(views, key) ? key : 'home'
  if (next === activeView) return
  if (queuedProfile && activeView === 'profile') {
    profileQueue.then(() => {
      if (activeView === next && !editor.open && !modal.open && next === 'home') render()
    })
  }
  selected.clear()
  bulk = false
  invalidateReports()
  activeView = next
  render()
  window.scrollTo(0, 0)
  if (ready) content.focus({ preventScroll: true })
}

function setState(next) {
  if (next.revision < state.revision) return
  if (next.revision !== state.revision) invalidateReports()
  state = next
}
async function persist(change) {
  pending++
  saveStatus('saving', 'Salvataggio…')
  try {
    const result = await updateState(change)
    setState(result)
    broadcasts?.postMessage(result.revision)
    saveStatus('saved', 'Salvato sul dispositivo', 'Salvato')
    renderChrome()
    for (const id of ['pdf-file','xlsx-file','backup-file','pdf-file-bottom','preview-section']) {
      const element = $(id)
      if (element) element.hidden = true
    }
    return result
  } catch (error) {
    if (error.name === 'RegisterConflict') saveStatus('saved', 'Archivio sul dispositivo', 'Dati locali')
    else saveStatus('error', 'Salvataggio non riuscito', 'Errore')
    throw error
  } finally {
    pending--
  }
}
function conflict(message) {
  const error = new Error(message)
  error.name = 'RegisterConflict'
  throw error
}
const sameDay = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
async function sync() {
  if (!ready || pending || document.visibilityState === 'hidden') return
  try {
    const next = await readState()
    if (next.revision <= state.revision) return
    setState(next)
    if (activeView === 'profile' && content.contains(document.activeElement)) {
      renderChrome()
      if ($('backup-file')) $('backup-file').hidden = true
      notify('Il registro è stato aggiornato da un’altra scheda.')
    } else render()
  } catch { saveStatus('error', 'Archivio non raggiungibile', 'Errore') }
}

function showModal(title, body, buttons, handler) {
  if (modal.open) return
  modalHandler = handler
  modal.innerHTML = `<div class="dialog-head"><h2 id="modal-title">${title}</h2>${iconButton('modal-close', 'close', 'Chiudi finestra')}</div>
    <div class="dialog-body">${body}<p id="modal-error" class="form-error" role="alert" hidden></p></div>
    <div class="dialog-actions">${buttons}</div>`
  modal.showModal()
}
function confirmChoice(title, body, choices) {
  return new Promise(resolve => {
    const choicesHtml = choices.map(([key, label, style]) => button('modal-value', label, style, '', `data-value="${key}"`)).join('')
    const onClose = () => resolve(null)
    modal.addEventListener('close', onClose, { once: true })
    showModal(title, `<p>${escape(body)}</p>`, button('modal-close', 'Annulla', 'quiet') + choicesHtml, target => {
      modal.removeEventListener('close', onClose)
      modal.close()
      resolve(target.dataset.value)
    })
  })
}
function periodDialog() {
  const months = Array.from({length:12}, (_, i) => labelMonth(2000, i + 1).replace(' 2000', ''))
  showModal('Scegli periodo', `<div class="field-grid">
    <div class="field"><label for="pick-month">Mese</label><select id="pick-month">${months.map((label, i) => `<option value="${i + 1}"${i + 1 === month ? ' selected' : ''}>${label}</option>`).join('')}</select></div>
    <div class="field"><label for="pick-year">Anno</label><input id="pick-year" inputmode="numeric" type="text" value="${year}"></div></div>`,
  button('modal-close', 'Annulla', 'quiet') + button('modal-value', 'Apri mese', 'primary'), () => {
    const value = $('pick-year').value.trim()
    if (!/^\d{4}$/.test(value) || Number(value) < minYear || Number(value) > maxYear) {
      showError($('modal-error'), 'Inserisci un anno da 1900 a 9999.')
      $('pick-year').focus()
      return
    }
    const nextMonth = Number($('pick-month').value)
    modal.close()
    showPeriod(Number(value), nextMonth)
    content.querySelector('[data-action="period"]')?.focus({ preventScroll: true })
  })
}
function dayFormMarkup(key, entry, exists) {
  const travel = ['fuori', 'viaggio'].some(field => entry[field] !== null) || entry.meters !== null
  const useTypical = hasTypical(state.profile)
  const canCopy = Object.keys(state.entries).some(date => date < key)
  return `<div class="dialog-head"><div><p>${exists ? 'Modifica giornata' : 'Nuova giornata'}</p><h2 id="editor-title">${labelDate(key)}</h2></div>
    ${iconButton('editor-close', 'close', 'Chiudi giornata', 'autofocus')}</div>
    <form id="day-form" novalidate autocomplete="off">
      <div class="dialog-body day-fields">
        <div class="day-sede">${fieldsTime('sede', durationLabels.sede, entry.sede)}
          <div class="quick-hours" role="group" aria-label="Scelte rapide per le ore in sede"${entry.status === 'lavoro' ? '' : ' hidden'}>
            ${[4, 6, 8].map(hours => button('quick-hours', `${hours} h`, 'secondary', '', `data-hours="${hours}" aria-pressed="false"`)).join('')}
          </div>
        </div>
        ${useTypical ? button('typical', 'Usa giornata tipo', 'quiet day-typical', 'bolt', 'aria-describedby="editor-typical-summary"') : ''}
        ${useTypical ? `<span id="editor-typical-summary" hidden>${escape(typicalSummary(state.profile))}</span>` : ''}
        <div class="day-status-line field"><label for="day-status">Tipo di giornata</label><select id="day-status" name="status">${Object.entries(statuses).map(([value,label]) => `<option value="${value}"${entry.status === value ? ' selected' : ''}>${label}</option>`).join('')}</select></div>
        <details class="day-disclosure" id="day-travel"${travel && exists ? ' open' : ''}>
          <summary><span class="day-disclosure-icon">${icon('truck')}</span><span><strong>Fuori sede, viaggio e km</strong><small id="day-travel-summary" hidden></small></span>${icon('right')}</summary>
          <div class="day-disclosure-body field-stack">
            ${fieldsTime('fuori', durationLabels.fuori, entry.fuori)}
            ${fieldsTime('viaggio', durationLabels.viaggio, entry.viaggio)}
            <div class="field"><label for="meters">Chilometri</label><input id="meters" name="meters" type="text" inputmode="decimal" enterkeyhint="next" value="${entry.meters == null ? '' : String(entry.meters / 1000).replace('.', ',')}" placeholder="0,0"></div>
          </div>
        </details>
        <details class="day-disclosure" id="day-details">
          <summary><span class="day-disclosure-icon">${icon('pin')}</span><span><strong>Luogo e note</strong><small id="day-details-summary" hidden></small></span>${icon('right')}</summary>
          <div class="day-disclosure-body field-stack">
            ${textField('luogo','Luogo',entry.luogo,'placeholder="Sede, cantiere o destinazione"')}
            <div class="field"><label for="note">Note</label><textarea id="note" name="note" maxlength="${limits.note}" rows="3" placeholder="Aggiungi una nota">${escape(entry.note)}</textarea></div>
          </div>
        </details>
        ${canCopy || exists ? `<details class="day-more"><summary>Altre azioni ${icon('right')}</summary>
          <div class="button-row">
            ${canCopy ? button('copy', 'Copia un giorno', 'quiet', 'copy') : ''}
            ${exists ? button('delete-day', 'Elimina giornata', 'quiet day-delete') : ''}
          </div></details>` : ''}
        <p id="editor-error" class="form-error" role="alert" hidden></p>
      </div>
      <div class="dialog-actions day-actions">
        <div class="day-total"><span>Totale ore</span><strong id="day-total" aria-live="polite"></strong></div>
        <button id="save-day" type="submit" class="primary">${icon('check')} Salva</button>
      </div>
    </form>`
}
function openDay(key) {
  if (editor.open || !isDateKey(key)) return
  const original = state.entries[key] ?? null
  dayEdit = { key, original, dirty: false }
  editor.innerHTML = dayFormMarkup(key, original ?? emptyDay(), Boolean(original))
  refreshDayPreview()
  editor.showModal()
}
function refreshDayPreview() {
  const form = $('day-form')
  const field = name => form.elements.namedItem(name).value
  const values = {}
  let valid = true
  for (const key of hoursFields) {
    try { values[key] = parseDuration(field(key + '-h'), field(key + '-m')) }
    catch { valid = false }
  }
  const sum = hoursFields.reduce((total, key) => total + (values[key] ?? 0), 0)
  const display = valid ? minutesText(sum) : '—'
  if ($('day-total').textContent !== display) $('day-total').textContent = display
  const shortcuts = form.querySelector('.quick-hours')
  shortcuts.hidden = field('status') !== 'lavoro'
  for (const control of shortcuts.querySelectorAll('button')) {
    control.setAttribute('aria-pressed', String(values.sede === Number(control.dataset.hours) * 60))
  }
  const travel = []
  if (values.fuori != null) travel.push(`${minutesText(values.fuori)} fuori sede`)
  if (values.viaggio != null) travel.push(`${minutesText(values.viaggio)} viaggio`)
  try {
    const meters = parseDistance(field('meters'))
    if (meters !== null) travel.push(`${kilometersText(meters)} km`)
  } catch {}
  const details = [field('luogo').trim(), field('note').trim() ? 'Nota aggiunta' : ''].filter(Boolean)
  showError($('day-travel-summary'), travel.join(' · '))
  showError($('day-details-summary'), details.join(' · '))
}
function readTime(form, name) {
  const hours = form.elements.namedItem(name + '-h')
  const minutes = form.elements.namedItem(name + '-m')
  try {
    const value = parseDuration(hours.value, minutes.value)
    hours.removeAttribute('aria-invalid')
    minutes.removeAttribute('aria-invalid')
    return value
  } catch (error) {
    hours.setAttribute('aria-invalid', 'true')
    minutes.setAttribute('aria-invalid', 'true')
    error.field = hours
    throw error
  }
}
function readDay(form) {
  const record = emptyDay()
  record.status = form.elements.namedItem('status').value
  for (const field of hoursFields) {
    try { record[field] = readTime(form, field) }
    catch (error) { error.message = `${durationLabels[field]}. ${error.message}`; throw error }
  }
  try {
    record.meters = parseDistance(form.elements.namedItem('meters').value)
    form.elements.namedItem('meters').removeAttribute('aria-invalid')
  } catch (error) {
    error.field = form.elements.namedItem('meters')
    error.field.setAttribute('aria-invalid', 'true')
    throw error
  }
  record.luogo = usableText(form.elements.namedItem('luogo').value.trim())
  record.note = usableText(form.elements.namedItem('note').value.trim())
  return record
}
function closeEditor() {
  editor.close()
  dayEdit = null
}
async function dismissEditor() {
  if (editBusy || !dayEdit) return
  if (dayEdit.dirty) {
    const discard = await confirmChoice('Annullare le modifiche?', 'Le modifiche di questa giornata non sono ancora state salvate.', [['yes', 'Esci senza salvare', 'danger']])
    if (!discard) return
  }
  closeEditor()
}
function editLock(locked) {
  editBusy = locked
  if ($('save-day')) $('save-day').disabled = locked
  const remove = editor.querySelector('[data-action="delete-day"]')
  if (remove) remove.disabled = locked
}
async function saveDay(form) {
  if (editBusy || !dayEdit) return
  const { key, original } = dayEdit
  const errors = $('editor-error')
  showError(errors, '')
  let entry
  try { entry = readDay(form) }
  catch (error) {
    showError(errors, error.message)
    const section = error.field?.closest('details')
    if (section) section.open = true
    error.field?.focus()
    return
  }
  editLock(true)
  try {
    await persist(draft => {
      if (!sameDay(draft.entries[key], original)) conflict('Questa giornata è stata modificata in un’altra scheda. Riaprila prima di salvare.')
      draft.entries[key] = entry
    })
    closeEditor()
    render()
    const target = activeView === 'home' ? '[data-action="today"]' : `[data-day="${key}"]`
    content.querySelector(target)?.focus({ preventScroll: true })
    notify('Giornata salvata')
  } catch (error) {
    showError(errors, error.name === 'RegisterConflict' ? error.message : 'Salvataggio non riuscito. I dati nel modulo sono ancora disponibili. Riprova.')
  } finally { editLock(false) }
}
async function deleteDay() {
  if (!dayEdit?.original || editBusy) return
  const { key, original } = dayEdit
  const answer = await confirmChoice('Eliminare la giornata?', `${labelDate(key)} tornerà tra i giorni da compilare.`, [['delete', 'Elimina', 'danger']])
  if (!answer) return
  editLock(true)
  try {
    await persist(draft => {
      if (!sameDay(draft.entries[key], original)) conflict('Questa giornata è stata aggiornata in un’altra scheda. Riaprila prima di eliminarla.')
      delete draft.entries[key]
    })
    closeEditor()
    render()
    const target = activeView === 'home' ? '[data-action="today"]' : `[data-day="${key}"]`
    content.querySelector(target)?.focus({ preventScroll: true })
    notify('Giornata eliminata')
  } catch (error) {
    showError($('editor-error'), error.name === 'RegisterConflict' ? error.message : 'Impossibile eliminare la giornata. Riprova.')
  } finally { editLock(false) }
}
function putTime(form, key, minutes) {
  form.elements.namedItem(key + '-h').value = minutes == null ? '' : Math.floor(minutes / 60)
  form.elements.namedItem(key + '-m').value = minutes == null ? '' : pad(minutes % 60)
}
const hasTypical = profile => profile.defaultSede !== null || !!profile.base
function typicalSummary(profile) {
  return [profile.defaultSede === null ? '' : minutesText(profile.defaultSede), profile.base].filter(Boolean).join(' · ')
}
async function saveTypicalToday(control) {
  if (quickSaveBusy) return
  const key = todayKey()
  if (key !== control.dataset.day) {
    render()
    notify('La data è cambiata. Controlla la giornata prima di salvare.')
    return
  }
  const shown = typicalDay(state.profile)
  quickSaveBusy = true
  control.disabled = true
  try {
    if (queuedProfile) await profileQueue
    await persist(draft => {
      if (draft.entries[key]) conflict('Oggi è già compilato. Apri la scheda per modificarlo.')
      if (!hasTypical(draft.profile) || !sameDay(typicalDay(draft.profile), shown)) {
        conflict('La giornata tipo è cambiata. Controlla i dati e riprova.')
      }
      draft.entries[key] = shown
    })
    if (activeView === 'home') {
      const [todayYear, todayMonth] = key.split('-').map(Number)
      showPeriod(todayYear, todayMonth)
      content.querySelector('[data-action="today"]')?.focus({ preventScroll: true })
    } else render()
    notify('Giornata di oggi salvata')
  } catch (error) {
    if (error.name === 'RegisterConflict') await sync()
    notify(error.name === 'RegisterConflict' ? error.message : 'Impossibile salvare la giornata. Riprova.')
  } finally {
    quickSaveBusy = false
    control.disabled = false
  }
}
async function applyTypical() {
  const editing = dayEdit
  if (queuedProfile) await profileQueue
  if (editBusy || !dayEdit || dayEdit !== editing) return
  if (!hasTypical(state.profile)) {
    showError($('editor-error'), 'Imposta il luogo abituale o le ore predefinite nella sezione Profilo.')
    return
  }
  const form = $('day-form')
  if (state.profile.defaultSede !== null) putTime(form, 'sede', state.profile.defaultSede)
  if (state.profile.base) form.elements.namedItem('luogo').value = state.profile.base
  form.elements.namedItem('status').value = 'lavoro'
  dayEdit.dirty = true
  refreshDayPreview()
  showError($('editor-error'), '')
}
function copyDay() {
  if (editBusy || !dayEdit) return
  const dates = Object.keys(state.entries).filter(key => key < dayEdit.key).sort().reverse()
  if (!dates.length) {
    showError($('editor-error'), 'Non ci sono giornate precedenti registrate da copiare.')
    return
  }
  showModal('Copia da una giornata', `<p>I campi del modulo saranno sostituiti. Puoi ancora modificarli prima di salvare.</p>
    <div class="field"><label for="copy-date">Giornata da copiare</label><select id="copy-date">${dates.map(key => `<option value="${key}">${labelDate(key)} · ${statuses[state.entries[key].status]}</option>`).join('')}</select></div>`,
  button('modal-close', 'Annulla', 'quiet') + button('modal-value', 'Copia i campi', 'primary'), () => {
    const entry = state.entries[$('copy-date').value]
    if (!entry) {
      showError($('modal-error'), 'La giornata selezionata non è più disponibile.')
      return
    }
    const form = $('day-form')
    hoursFields.forEach(key => putTime(form, key, entry[key]))
    for (const key of ['status','luogo','note']) form.elements.namedItem(key).value = entry[key]
    form.elements.namedItem('meters').value = entry.meters == null ? '' : String(entry.meters / 1000).replace('.', ',')
    dayEdit.dirty = true
    if (entry.status !== 'lavoro') $('day-details').open = true
    refreshDayPreview()
    showError($('editor-error'), '')
    modal.close()
  })
}
async function applyBulk() {
  if (queuedProfile) await profileQueue
  if (!selected.size || modal.open) return
  if (!hasTypical(state.profile)) {
    notify('Imposta la giornata tipo nella sezione Profilo.')
    return
  }
  const dates = [...selected]
  const original = new Map(dates.map(key => [key, state.entries[key]]))
  const conflicts = dates.filter(key => original.get(key)).length
  const choice = await confirmChoice('Applicare la giornata tipo?',
    conflicts ? `${conflicts} di ${dates.length} giorni contengono già dati. Con “Sovrascrivi tutti” i campi presenti in questi giorni saranno sostituiti dalla giornata tipo.` :
      `Saranno compilati i ${dates.length} giorni selezionati con le impostazioni del profilo.`,
    conflicts ? [['skip', 'Solo giorni vuoti', 'secondary'], ['overwrite', 'Sovrascrivi tutti', 'danger']] : [['skip', 'Applica', 'primary']])
  if (!choice) return
  let changed = 0
  try {
    await persist(draft => {
      if (!hasTypical(draft.profile)) conflict('La giornata tipo non è più impostata.')
      for (const key of dates) {
        if (choice === 'skip' && draft.entries[key]) continue
        if (!sameDay(draft.entries[key], original.get(key))) conflict('Le giornate sono cambiate in un’altra scheda. Rivedi la selezione e riprova.')
        draft.entries[key] = typicalDay(draft.profile)
        changed++
      }
    })
    bulk = false
    selected.clear()
    render()
    notify(changed ? `${changed} ${changed === 1 ? 'giorno compilato' : 'giorni compilati'}` : 'Nella selezione non ci sono giorni vuoti.')
  } catch (error) {
    notify(error.name === 'RegisterConflict' ? error.message : 'Impossibile salvare la selezione.')
    await sync()
  }
}
function enqueueProfile(change, onSaved = () => {}) {
  queuedProfile++
  profileQueue = profileQueue.then(async () => {
    try {
      await persist(change)
      onSaved()
    } catch {
      const form = $('profile-form')
      if (form) showError($('profile-error'), 'Modifica non salvata. Reinserisci il valore o riprova il caricamento.')
      else notify('Modifica del profilo non salvata.')
    } finally { queuedProfile-- }
  })
}
function saveProfileField(input) {
  const form = $('profile-form')
  const errorBox = $('profile-error')
  const key = input.name.startsWith('defaultSede-') ? 'defaultSede' : input.name
  if (!['azienda', 'base', 'defaultSede'].includes(key)) return
  let value
  if (key === 'defaultSede') {
    try { value = readTime(form, key) }
    catch (error) {
      showError(errorBox, `Giornata tipo. ${error.message}`)
      return
    }
  } else value = usableText(input.value.trim())
  if (!form.querySelector('[aria-invalid=true]')) showError(errorBox, '')
  enqueueProfile(draft => { draft.profile[key] = value })
}
function decodeImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Il file immagine non può essere aperto.'))
    image.src = src
  })
}
async function normalizeLogo(file) {
  if (!file || !['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) {
    throw new Error('Seleziona un file PNG, JPEG o WebP fino a 12 MB.')
  }
  const url = URL.createObjectURL(file)
  try {
    const image = await decodeImage(url)
    const scale = Math.min(1, 420 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } finally { URL.revokeObjectURL(url) }
}
async function validateBackupLogo(logo) {
  if (!logo) return
  try {
    const head = atob(logo.split(',')[1].slice(0, 44))
    const header = new DataView(Uint8Array.from(head, char => char.charCodeAt(0)).buffer)
    if (header.getUint32(8) !== 13 || header.getUint32(12) !== 0x49484452 || header.getUint32(16) > 420 || header.getUint32(20) > 420) {
      throw new Error()
    }
    await decodeImage(logo)
  } catch { throw new Error('Il logo nel backup è danneggiato o non valido.') }
}
async function setLogo(input) {
  const file = input.files[0]
  input.value = ''
  if (!file || imageBusy) return
  imageBusy = true
  const errorBox = $('profile-error')
  try {
    const logo = await normalizeLogo(file)
    showError(errorBox, '')
    enqueueProfile(draft => { draft.profile.logo = logo }, () => {
      if ($('logo-preview')) $('logo-preview').innerHTML = logoMarkup(state.profile.logo)
    })
  } catch (error) { showError(errorBox, error.message) }
  finally { imageBusy = false }
}

function fileButtons(id, type, caption) {
  const place = $(id)
  const item = prepared.get(type)
  if (!place || !item) return
  let canShare = false
  try { canShare = navigator.canShare?.({ files: [item.file] }) === true } catch {}
  place.innerHTML = `<a class="secondary" href="${item.url}" download="${item.file.name}">${icon('export')} Salva ${caption}</a>` +
    (canShare ? button('share-file', 'Condividi', 'quiet', 'share', `data-file="${type}" aria-label="Condividi ${caption}"`) : '')
  place.hidden = false
}
function shareFile(type) {
  const item = prepared.get(type)
  if (!item) return
  try {
    navigator.share({ files: [item.file], title: item.file.name }).catch(error => {
      if (error.name !== 'AbortError') notify('Condivisione non disponibile. Usa Salva e condividi il file dall’app File.')
    })
  } catch { notify('Usa Salva e poi condividi il file dall’app File.') }
}
const periodFile = report => `${report.year}-${pad(report.month)}`
async function openPreview(control) {
  if (queuedProfile) await profileQueue
  if (!control.isConnected) return
  const token = ++previewToken
  const section = $('preview-section')
  const area = $('paper-area')
  const description = $('preview-description')
  control.disabled = true
  section.hidden = false
  area.hidden = true
  description.textContent = 'Preparazione del foglio…'
  try {
    const report = currentReport()
    const pdf = await pdfReport(report)
    if (token !== previewToken || !section.isConnected) return
    storeFile('pdf', `registro-ore-${periodFile(report)}.pdf`, 'application/pdf', pdf.bytes)
    area.replaceChildren(renderPaper(pdf.pages, report.profile.logo))
    area.hidden = false
    description.textContent = `${labelMonth(year, month)} · ${pdf.pages.length} ${pdf.pages.length === 1 ? 'pagina' : 'pagine'} A4`
    fileButtons('pdf-file','pdf','PDF')
    fileButtons('pdf-file-bottom','pdf','PDF')
    $('preview-title').focus()
  } catch {
    if (token === previewToken) description.textContent = 'Impossibile preparare il PDF. Riprova con una connessione attiva.'
  } finally { if (control.isConnected) control.disabled = false }
}
async function prepareExcel(control) {
  if (queuedProfile) await profileQueue
  if (!control.isConnected) return
  const report = currentReport()
  const revision = state.revision
  control.disabled = true
  try {
    const bytes = await xlsxReport(report)
    if (revision !== state.revision || !control.isConnected) return
    storeFile('xlsx', `registro-ore-${periodFile(report)}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytes)
    fileButtons('xlsx-file', 'xlsx', 'Excel')
    $('xlsx-file').querySelector('a')?.focus()
  } catch { notify('Impossibile preparare Excel. Riprova con una connessione attiva.') }
  finally { if (control.isConnected) control.disabled = false }
}
async function prepareBackup(control) {
  control.disabled = true
  try {
    await profileQueue
    if (!control.isConnected) return
    setState(await readState())
    const backup = makeBackup(state)
    storeFile('backup', `registro-ore-backup-${todayKey()}.json`, 'application/json', JSON.stringify(backup, null, 2))
    fileButtons('backup-file', 'backup', 'backup')
    $('backup-file').querySelector('a')?.focus()
  } catch { notify('Impossibile creare il backup. Riprova.') }
  finally { control.disabled = false }
}
let importing = false
async function importBackup(input) {
  const file = input.files[0]
  input.value = ''
  if (!file || importing) return
  importing = true
  const errors = $('backup-error')
  try {
    showError(errors, '')
    if (file.size > 64 * 1024 * 1024) throw new Error('Il file supera il limite di 64 MB.')
    const imported = parseBackup(await file.text())
    await validateBackupLogo(imported.profile.logo)
    await profileQueue
    if (!errors.isConnected) return
    const previous = await readState()
    if (!errors.isConnected) return
    const fileCount = Object.keys(imported.entries).length
    const localCount = Object.keys(previous.entries).length
    const accept = await confirmChoice('Ripristinare il backup?',
      `Il file contiene ${fileCount} ${fileCount === 1 ? 'giornata' : 'giornate'}. Importerai il backup nel registro di ${fullName(imported.profile)}, sostituendo le impostazioni e i dati presenti (${localCount} ${localCount === 1 ? 'giornata' : 'giornate'}).`,
      [['replace', 'Sostituisci dati', 'danger']])
    if (!accept) return
    setState(await persist(draft => {
      if (draft.revision !== previous.revision) conflict('I dati sono cambiati dopo la conferma. Seleziona di nuovo il file.')
      Object.assign(draft, imported)
    }))
    render()
    notify('Backup ripristinato')
  } catch (error) {
    const message = error.name === 'QuotaExceededError' ? 'Spazio insufficiente sul dispositivo. Il ripristino è stato annullato.' :
      `${error.message || 'Ripristino non riuscito'} I dati presenti sono rimasti invariati.`
    if (errors.isConnected) showError(errors, message)
    else notify(message)
  } finally { importing = false }
}

const actions = {
  'quick-typical': saveTypicalToday,
  'quick-hours': control => {
    if (!dayEdit || editBusy) return
    const form = $('day-form')
    putTime(form, 'sede', Number(control.dataset.hours) * 60)
    for (const name of ['sede-h', 'sede-m']) form.elements.namedItem(name).removeAttribute('aria-invalid')
    dayEdit.dirty = true
    refreshDayPreview()
    if (!form.querySelector('[aria-invalid=true]')) showError($('editor-error'), '')
  },
  reload: () => location.reload(),
  prev: () => changeMonth(-1), next: () => changeMonth(1), period: periodDialog,
  today: () => {
    const key = todayKey()
    const y = Number(key.slice(0, 4))
    const m = Number(key.slice(5, 7))
    if (year !== y || month !== m) showPeriod(y, m)
    openDay(key)
  },
  day: target => openDay(target.dataset.day),
  'bulk-toggle': () => {
    bulk = !bulk
    selected.clear()
    render()
    content.querySelector('[data-action="bulk-toggle"]')?.focus({ preventScroll: true })
  },
  'bulk-day': target => {
    const { day } = target.dataset
    if (selected.has(day)) selected.delete(day)
    else selected.add(day)
    render()
    content.querySelector(`[data-day="${day}"]`)?.focus({ preventScroll: true })
  },
  'bulk-clear': () => {
    selected.clear()
    render()
    content.querySelector('[data-action="bulk-toggle"]')?.focus({ preventScroll: true })
  },
  'bulk-apply': applyBulk,
  'editor-close': dismissEditor,
  'delete-day': deleteDay,
  typical: applyTypical, copy: copyDay,
  'modal-close': () => modal.close(),
  'modal-value': target => modalHandler?.(target),
  preview: openPreview, excel: prepareExcel,
  backup: prepareBackup,
  import: () => $('import-file').click(),
  'share-file': target => shareFile(target.dataset.file),
  'remove-logo': () => enqueueProfile(draft => { draft.profile.logo = '' }, () => {
    if ($('logo-preview')) $('logo-preview').replaceChildren()
  }),
}

document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]')
  if (target && !target.disabled) actions[target.dataset.action]?.(target)
})
document.addEventListener('submit', event => {
  event.preventDefault()
  if (event.target.id === 'day-form') saveDay(event.target)
})
document.addEventListener('input', event => {
  const target = event.target
  if (target.closest('#day-form') && dayEdit) {
    dayEdit.dirty = true
    target.removeAttribute('aria-invalid')
    refreshDayPreview()
  }
  if (target.closest('#profile-form') && target.type !== 'file') saveProfileField(target)
})
document.addEventListener('change', event => {
  const target = event.target
  if (target.id === 'day-status' && dayEdit) {
    dayEdit.dirty = true
    if (target.value !== 'lavoro') $('day-details').open = true
    refreshDayPreview()
  }
  if (target.id === 'logo') setLogo(target)
  if (target.id === 'import-file') importBackup(target)
  if (target.id === 'theme') {
    const choice = target.value
    enqueueProfile(draft => { draft.settings.theme = choice })
  }
})
editor.addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.isComposing || !event.target.matches('input[inputmode]')) return
  event.preventDefault()
  const inputs = [...editor.querySelectorAll('input[inputmode]')].filter(field => field.getClientRects().length)
  const next = inputs[inputs.indexOf(event.target) + 1] ?? $('save-day')
  next.focus()
})
editor.addEventListener('cancel', event => {
  event.preventDefault()
  dismissEditor()
})
window.addEventListener('hashchange', route)
document.addEventListener('visibilitychange', sync)
broadcasts?.addEventListener('message', sync)
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', renderChrome)

async function init() {
  route()
  try {
    state = await readState()
    ready = true
    saveStatus('saved', 'Archivio sul dispositivo', 'Dati locali')
  } catch {
    loadError = true
    saveStatus('error', 'Archivio non disponibile', 'Errore')
    const banner = $('storage-banner')
    banner.textContent = 'Apri il registro in Safari o dall’icona della Home. Verifica lo spazio disponibile e ricarica.'
    banner.hidden = false
  }
  render()
  if (window.isSecureContext && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  }
}
init()
