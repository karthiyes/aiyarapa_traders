export function exportToCSV(filename, rows) {
  if (!rows || rows.length === 0) {
    alert('No data to export.')
    return
  }
  const headers = Object.keys(rows[0])
  const escape = (val) => {
    if (val === null || val === undefined) return ''
    const str = String(val).replace(/"/g, '""')
    return /[",\n]/.test(str) ? `"${str}"` : str
  }
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))
  ]
  const csvContent = '\uFEFF' + lines.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
