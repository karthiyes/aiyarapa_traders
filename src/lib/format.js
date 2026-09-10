export function formatINR(amount) {
  const n = Number(amount) || 0
  return n.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  })
}

export function formatNumber(n, decimals = 2) {
  const v = Number(n) || 0
  return v.toLocaleString('en-IN', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0
  })
}

export function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function todayISO() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

export function monthStartISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// Convert an entered quantity+unit into the product's base stock unit (KG)
export function toBaseKG(quantity, unit, product) {
  const q = Number(quantity) || 0
  if (!product) return q
  if (unit === 'KG') return q
  if (unit === 'Pack') return q * (Number(product.pack_to_kg) || 0)
  if (unit === 'Ton') return q * (Number(product.kg_to_ton) || 1000)
  return q
}
