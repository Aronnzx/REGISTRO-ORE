import { statuses, minutesText, kilometersText, fullName, formatDate, labelMonth, dateFor } from './core.mjs?v=11'

const pageWidth = 595.28
const pageHeight = 841.89
const left = 26
const right = 569
const tableWidth = right - left
const columns = [43, 45, 54, 54, 52, 54, 121, 120]
const headings = ['Giorno', 'Data', 'Ore in sede', 'Ore fuori sede', 'Ore di viaggio', 'Km', 'Note / stato', 'Luogo']
const lineHeight = 10.3
const bottom = 799
const colors = { ink: '#182739', navy: '#102741', blue: '#24597a', muted: '#526477', border: '#c3ccd8',
  white: '#ffffff', row: '#f3f6fa', absence: '#edf5fb', accent: '#dceaf5' }

const loadedScripts = new Map()
function loadScript(path, globalName) {
  if (globalThis[globalName]) return Promise.resolve(globalThis[globalName])
  if (!loadedScripts.has(path)) {
    loadedScripts.set(path, new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = path
      script.onload = () => resolve(globalThis[globalName])
      script.onerror = () => {
        loadedScripts.delete(path)
        script.remove()
        reject(new Error('Impossibile caricare il componente di esportazione. Riprova con una connessione.'))
      }
      document.head.append(script)
    }))
  }
  return loadedScripts.get(path)
}

function textPaper(pdf, fonts) {
  const context = document.createElement('canvas').getContext('2d')
  const allowed = Object.fromEntries(Object.entries(fonts).map(([key, font]) => [key, new Set(font.getCharacterSet())]))
  const canEncode = (string, style) => Array.from(string).every(letter => allowed[style].has(letter.codePointAt(0)))
  const cssFont = (size, style) => `${style === 'bold' ? 700 : 400} ${size}px Arial, sans-serif`
  function width(string, size, style) {
    if (canEncode(string, style)) return fonts[style].widthOfTextAtSize(string, size)
    context.font = cssFont(size, style)
    return context.measureText(string).width
  }
  function bitmap(string, size, style, color, nominalWidth) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil((nominalWidth + 2) * 3)
    canvas.height = Math.ceil(size * 1.65 * 3)
    const ctx = canvas.getContext('2d')
    ctx.scale(3, 3)
    ctx.font = cssFont(size, style)
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = color
    ctx.fillText(string, 0, size)
    return canvas
  }
  return { pdf, fonts, canEncode, width, bitmap }
}

const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('it', { granularity: 'grapheme' }) : null
const graphemes = text => segmenter ? Array.from(segmenter.segment(text), item => item.segment) : Array.from(text)
function wrap(raw, width, size, style, paper) {
  const result = []
  const fits = value => paper.width(value, size, style) <= width
  for (const paragraph of String(raw).replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n')) {
    let line = ''
    for (const token of paragraph.match(/\s+|\S+/gu) ?? []) {
      if (fits(line + token)) {
        line += token
        continue
      }
      if (line) result.push(line)
      line = ''
      if (/^\s+$/u.test(token)) continue
      if (fits(token)) {
        line = token
        continue
      }
      for (const part of graphemes(token)) {
        if (line && !fits(line + part)) {
          result.push(line)
          line = ''
        }
        line += part
      }
    }
    result.push(line)
  }
  return result
}

function layoutReport(report, paper) {
  const { profile, rows, total, year, month } = report
  const period = labelMonth(year, month)
  const pages = []
  let page
  let y
  const add = item => page.push(item)
  const rect = (x, top, w, h, fill, stroke) => add({ type: 'rect', x, top, w, h, fill, stroke })
  const line = (x, top, endX, endY, fill = colors.border) => add({ type: 'line', x, top, endX, endY, fill })
  const text = (value, x, baseline, size = 8, style = 'regular', fill = colors.ink, align = 'left') => {
    if (!value) return
    const w = paper.width(value, size, style)
    const start = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x
    add({ type: 'text', value, x: start, baseline, size, style, fill, w })
  }
  const multi = (lines, x, first, size, style, fill) =>
    lines.forEach((value, index) => text(value, x, first + index * (size + 3), size, style, fill))

  function newPage() {
    page = []
    pages.push(page)
    rect(left, 26, tableWidth, 3, colors.navy)
    const headerX = profile.logo ? 119 : left + 2
    if (profile.logo) add({ type: 'logo', x: left + 2, top: 41, w: 79, h: 49 })
    text('REGISTRO ORE LAVORO', headerX, 55, 17, 'bold', colors.navy)
    text(period, right - 2, 55, 12, 'bold', colors.blue, 'right')
    const headerW = right - headerX - 6
    const names = wrap(fullName(profile) || 'Lavoratore da indicare', headerW, 10, 'bold', paper)
    const companies = profile.azienda ? wrap(profile.azienda, headerW, 9, 'regular', paper) : []
    multi(names, headerX, 73, 10, 'bold', colors.ink)
    multi(companies, headerX, 73 + names.length * 13, 9, 'regular', colors.muted)
    y = Math.max(103, 84 + names.length * 13 + companies.length * 12)
    rect(left, y, tableWidth, 20, colors.navy)
    let x = left
    headings.forEach((heading, index) => {
      text(heading, index > 5 ? x + 5 : x + columns[index] / 2, y + 13, 7.5, 'bold', colors.white, index > 5 ? 'left' : 'center')
      x += columns[index]
    })
    y += 20
  }

  function gridRow(cells, height, fill, bold = false) {
    rect(left, y, tableWidth, height, fill, colors.border)
    let x = left
    cells.forEach((cell, index) => {
      if (index) line(x, y, x, y + height)
      cell.forEach((value, lineIndex) => {
        const align = index > 5 ? 'left' : 'center'
        const textX = align === 'left' ? x + 5 : x + columns[index] / 2
        const measured = paper.width(value, 8, bold ? 'bold' : 'regular')
        const display = index <= 5 && measured > columns[index] - 7 ? 8 * (columns[index] - 7) / measured : 8
        text(value, textX, y + 10.2 + lineIndex * lineHeight, display, bold ? 'bold' : 'regular', colors.ink, align)
      })
      x += columns[index]
    })
    y += height
  }

  newPage()
  for (const [rowIndex, { key, weekday, entry }] of rows.entries()) {
    const status = entry && entry.status !== 'lavoro' ? statuses[entry.status] : ''
    const note = status && entry.note ? `${status}\n${entry.note}` : status || entry?.note || ''
    const wrappedNote = wrap(note, columns[6] - 10, 8, 'regular', paper)
    const wrappedPlace = wrap(entry?.luogo || '', columns[7] - 10, 8, 'regular', paper)
    const count = Math.max(wrappedNote.length, wrappedPlace.length)
    const numeric = ['sede', 'fuori', 'viaggio'].map(name => entry?.[name] == null ? '' : minutesText(entry[name]))
    const km = entry?.meters == null ? '' : kilometersText(entry.meters)
    const fill = status ? colors.absence : rowIndex % 2 === 0 ? colors.white : colors.row
    let offset = 0
    if (y + 6 + count * lineHeight > bottom && count <= 8) newPage()
    while (offset < count) {
      let take = Math.min(Math.floor((bottom - y - 6) / lineHeight), count - offset)
      if (take <= 0) {
        newPage()
        take = Math.min(Math.floor((bottom - y - 6) / lineHeight), count - offset)
      }
      const ddmm = formatDate(key).slice(0, 5)
      const firstCells = offset ? [['Segue'], [ddmm], [], [], [], []] :
        [[weekday], [ddmm], ...numeric.map(value => [value]), [km]]
      gridRow([...firstCells, wrappedNote.slice(offset, offset + take), wrappedPlace.slice(offset, offset + take)],
        6 + take * lineHeight, fill)
      offset += take
    }
  }

  const absence = Object.entries(statuses).filter(([key]) => key !== 'lavoro')
    .map(([key, value]) => `${value} ${total.counts[key]}`).join('  ·  ')
  if (y + 57 > bottom) newPage()
  gridRow([['Totale'], [], [minutesText(total.sede)], [minutesText(total.fuori)], [minutesText(total.viaggio)],
    [kilometersText(total.meters)], [], []], 20, colors.accent, true)
  text(`Totale ore  ${minutesText(total.hours)}    ·    Giornate di lavoro  ${total.counts.lavoro}`, left + 3, y + 14, 9, 'bold', colors.navy)
  text(absence, left + 3, y + 29, 8, 'regular', colors.muted)

  pages.forEach((items, i) => {
    page = items
    line(left, 810, right, 810)
    text(period, left, 822, 7.5, 'regular', colors.muted)
    text(`Pagina ${i + 1} di ${pages.length}`, right, 822, 7.5, 'regular', colors.muted, 'right')
  })
  return pages
}

const scaledImage = (image, { w, h }) => {
  const scale = Math.min(w / image.width, h / image.height)
  return [image.width * scale, image.height * scale]
}
async function writePdf(document, pdfLib, paper, pages, profile, title) {
  const color = value => pdfLib.rgb(...[1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16) / 255))
  const logo = profile.logo ? await document.embedPng(profile.logo) : null
  document.setTitle(title)
  document.setCreator('Registro Ore Lavoro')
  for (const items of pages) {
    const page = document.addPage([pageWidth, pageHeight])
    for (const item of items) {
      const { x, top, w, h, fill, stroke, type } = item
      if (type === 'rect') page.drawRectangle({ x, y: pageHeight - top - h, width: w, height: h,
        color: color(fill), ...(stroke ? { borderColor: color(stroke), borderWidth: 0.45 } : {}) })
      if (type === 'line') page.drawLine({ start: { x, y: pageHeight - top }, end: { x: item.endX, y: pageHeight - item.endY },
        color: color(fill), thickness: 0.45 })
      if (type === 'logo' && logo) {
        const [width, height] = scaledImage(logo, item)
        page.drawImage(logo, { x, y: pageHeight - top - height, width, height })
      }
      if (type !== 'text') continue
      if (paper.canEncode(item.value, item.style)) {
        page.drawText(item.value, { x, y: pageHeight - item.baseline, size: item.size,
          font: paper.fonts[item.style], color: color(fill) })
      } else {
        const canvas = paper.bitmap(item.value, item.size, item.style, fill, w)
        const image = await document.embedPng(canvas.toDataURL())
        const height = canvas.height / 3
        page.drawImage(image, { x, y: pageHeight - item.baseline + item.size - height, width: canvas.width / 3, height })
      }
    }
  }
  return document.save()
}

export async function pdfReport(report) {
  const pdfLib = await loadScript('./vendor/pdf-lib.min.js', 'PDFLib')
  const pdf = await pdfLib.PDFDocument.create()
  const regular = await pdf.embedFont(pdfLib.StandardFonts.Helvetica)
  const bold = await pdf.embedFont(pdfLib.StandardFonts.HelveticaBold)
  const paper = textPaper(pdf, { regular, bold })
  const pages = layoutReport(report, paper)
  const bytes = await writePdf(pdf, pdfLib, paper, pages, report.profile, `Registro ore · ${labelMonth(report.year, report.month)}`)
  return { bytes, pages }
}

export function renderPaper(pages, logo) {
  const fragment = document.createDocumentFragment()
  pages.forEach((items, index) => {
    const page = document.createElement('div')
    page.className = 'paper'
    page.setAttribute('role', 'group')
    page.setAttribute('aria-label', `Pagina ${index + 1} di ${pages.length}`)
    function ratio(value, total) { return `${value / total * 100}%` }
    items.forEach(item => {
      const node = document.createElement(item.type === 'logo' ? 'img' : 'span')
      node.className = `ink-${item.type}`
      node.style.left = ratio(item.x, pageWidth)
      if (item.type === 'text') {
        node.style.top = ratio(item.baseline, pageHeight)
        node.style.fontSize = `${item.size / pageWidth * 100}cqw`
        node.style.fontWeight = item.style === 'bold' ? 700 : 400
        node.style.color = item.fill
        node.textContent = item.value
      } else {
        node.style.top = ratio(item.top, pageHeight)
        if (item.type === 'line') {
          node.style.width = item.endX === item.x ? '1px' : ratio(item.endX - item.x, pageWidth)
          node.style.height = item.endY === item.top ? '1px' : ratio(item.endY - item.top, pageHeight)
        } else {
          node.style.width = ratio(item.w, pageWidth)
          node.style.height = ratio(item.h, pageHeight)
        }
        if (item.type === 'logo') {
          node.src = logo
          node.alt = 'Logo aziendale'
        } else {
          node.style.background = item.fill
          if (item.stroke) node.style.border = `1px solid ${item.stroke}`
        }
      }
      page.append(node)
    })
    fragment.append(page)
  })
  return fragment
}

const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const docRels = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const pkgRels = 'http://schemas.openxmlformats.org/package/2006/relationships'
const xText = value => String(value).replace(/_[xX][0-9a-fA-F]{4}_/g, match => '_x005F_' + match.slice(1))
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
  .replaceAll('\r', '&#13;')
const cell = (ref, value, style = 0) => value == null ? `<c r="${ref}" s="${style}"/>` :
  typeof value === 'number' ? `<c r="${ref}" s="${style}"><v>${value}</v></c>` :
    `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xText(value)}</t></is></c>`
const formula = (ref, expression, cached, style) =>
  `<c r="${ref}" s="${style}"><f>${xText(expression)}</f><v>${cached}</v></c>`
const rowXml = (index, cells, height) => `<row r="${index}"${height ? ` ht="${height}" customHeight="1"` : ''}>${cells.join('')}</row>`
const excelDay = key => {
  const d = dateFor(key)
  const days = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 31)) / 86400000)
  return days >= 60 ? days + 1 : days
}
const excelDuration = minutes => minutes === null || minutes === undefined ? null : minutes / 1440
const excelKm = meters => meters == null ? null : meters / 1000
const relationships = pairs => `${xmlHeader}<Relationships xmlns="${pkgRels}">${pairs.map(([id, kind, target]) =>
  `<Relationship Id="${id}" Type="${docRels}/${kind}" Target="${target}"/>`).join('')}</Relationships>`
const filesTypes = `${xmlHeader}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
const fontXml = (color = 'FF182739', bold = false, size = 11) =>
  `<font>${bold ? '<b/>' : ''}<sz val="${size}"/><color rgb="${color}"/><name val="Calibri"/><family val="2"/></font>`
const fillXml = color => `<fill><patternFill patternType="solid"><fgColor rgb="${color}"/><bgColor indexed="64"/></patternFill></fill>`
const xf = (fmt, font, fill, alignment = '') => `<xf numFmtId="${fmt}" fontId="${font}" fillId="${fill}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"${alignment ? ` applyAlignment="1"><alignment ${alignment}/></xf>` : '/>'}`
const themeStyles = `${xmlHeader}<styleSheet xmlns="${main}">
<numFmts count="3"><numFmt numFmtId="164" formatCode="[h]&quot; h &quot;mm&quot; min&quot;"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/><numFmt numFmtId="166" formatCode="0.###"/></numFmts>
<fonts count="4">${fontXml()}${fontXml('FFFFFFFF', true)}${fontXml('FF102741', true, 16)}${fontXml('FF102741', true)}</fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fillXml('FF102741')}${fillXml('FFDCEAF5')}</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">${[xf(0,0,0),xf(0,2,0),xf(0,1,2,'wrapText="1" vertical="center"'),xf(165,0,0),
  xf(164,0,0),xf(166,0,0),xf(0,0,0,'vertical="top" wrapText="1"'),xf(0,3,3),xf(164,3,3),xf(166,3,3)].join('')}</cellXfs>
<cellStyles count="1"><cellStyle name="Normale" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`
export async function xlsxReport({ year, month, rows, profile, total }) {
  const JSZip = await loadScript('./vendor/jszip.min.js', 'JSZip')
  const zip = new JSZip()
  const data = [
    rowXml(1, [cell('A1', 'Registro ore lavoro', 1)], 27),
    rowXml(2, [cell('A2', 'Lavoratore'), cell('B2', fullName(profile), 6)], 30),
    rowXml(3, [cell('A3', 'Azienda'), cell('B3', profile.azienda, 6)], 30),
    rowXml(4, [cell('A4', 'Periodo'), cell('B4', labelMonth(year, month))], 18),
    rowXml(6, ['Giorno','Data','Ore in sede','Ore fuori sede','Ore di viaggio','Chilometri','Note','Luogo','Stato']
      .map((value, index) => cell(`${'ABCDEFGHI'[index]}6`, value, 2)), 25),
  ]
  rows.forEach(({ weekday, key, entry }, index) => {
    const n = index + 7
    const values = [weekday, excelDay(key), excelDuration(entry?.sede), excelDuration(entry?.fuori),
      excelDuration(entry?.viaggio), excelKm(entry?.meters), entry?.note, entry?.luogo, entry ? statuses[entry.status] : null]
    const lineCount = Math.max(1, ...[entry?.note, entry?.luogo].map(value => (value || '').split('\n')
      .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 28)), 0)))
    data.push(rowXml(n, values.map((value, col) => cell('ABCDEFGHI'[col] + n, value, [0,3,4,4,4,5,6,6,0][col])),
      Math.min(390, lineCount * 17 + 2)))
  })
  const last = 6 + rows.length
  const sumAt = last + 1
  data.push(rowXml(sumAt, [cell('A' + sumAt, 'Totale', 7), cell('B' + sumAt, null, 7),
    ...['sede', 'fuori', 'viaggio', 'meters'].map((key, i) => {
      const letter = 'CDEF'[i]
      return formula(letter + sumAt, `SUM(${letter}7:${letter}${last})`, i === 3 ? excelKm(total.meters) : excelDuration(total[key]), i === 3 ? 9 : 8)
    })], 22))
  data.push(rowXml(sumAt + 2, [cell('A' + (sumAt + 2), 'Totale ore', 7),
    formula('C' + (sumAt + 2), `SUM(C${sumAt}:E${sumAt})`, excelDuration(total.hours), 8)], 21))
  Object.entries(statuses).forEach(([key, label], i) => {
    const n = sumAt + 4 + i
    data.push(rowXml(n, [cell('A' + n, label), formula('B' + n, `COUNTIF(I7:I${last},"${label}")`, total.counts[key], 0)]))
  })
  const widths = [19, 16, 17, 17, 17, 16, 49, 37, 16]
  zip.file('[Content_Types].xml', filesTypes)
  zip.file('_rels/.rels', relationships([['rId1', 'officeDocument', 'xl/workbook.xml']]))
  zip.file('xl/workbook.xml', `${xmlHeader}<workbook xmlns="${main}" xmlns:r="${docRels}"><sheets><sheet name="Registro mensile" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`)
  zip.file('xl/_rels/workbook.xml.rels', relationships([['rId1', 'worksheet', 'worksheets/sheet1.xml'], ['rId2', 'styles', 'styles.xml']]))
  zip.file('xl/styles.xml', themeStyles)
  zip.file('xl/worksheets/sheet1.xml', `${xmlHeader}<worksheet xmlns="${main}">
    <sheetViews><sheetView workbookViewId="0"><pane ySplit="6" topLeftCell="A7" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A7" sqref="A7"/></sheetView></sheetViews>
    <sheetFormatPr defaultRowHeight="17"/><cols>${widths.map((width, i) => `<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join('')}</cols>
    <sheetData>${data.join('')}</sheetData><mergeCells count="4"><mergeCell ref="A1:I1"/><mergeCell ref="B2:I2"/><mergeCell ref="B3:I3"/><mergeCell ref="B4:I4"/></mergeCells>
    <pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.15" footer="0.15"/>
  </worksheet>`)
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}
