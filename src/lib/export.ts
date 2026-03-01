import * as XLSX from 'xlsx'

export type ExportRow = Record<string, string | number | boolean | null | undefined>

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function csvEscape(value: unknown): string {
  if (value == null) return ''
  const s = String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`
  return s
}

export function exportCsv(filename: string, rows: ExportRow[]): void {
  const headers = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k))
      return set
    }, new Set<string>()),
  )
  const lines: string[] = []
  lines.push(headers.map(csvEscape).join(','))
  rows.forEach((r) => {
    lines.push(headers.map((h) => csvEscape(r[h])).join(','))
  })
  const blob = new Blob([`` + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  downloadBlob(filename, blob)
}

export function exportXlsx(filename: string, sheetName: string, rows: ExportRow[]): void {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}

