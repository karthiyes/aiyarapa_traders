import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Button, Select, Input, PageHeader, Card, EmptyState } from '../components/ui.jsx'
import { formatNumber, formatDate, todayISO } from '../lib/format.js'

const TYPES = [
  { value: 'pack_to_kg', label: 'Pack → KG' },
  { value: 'kg_to_ton', label: 'KG → Ton' },
  { value: 'ton_to_kg', label: 'Ton → KG' }
]

export default function StockConversion() {
  const [products, setProducts] = useState([])
  const [productId, setProductId] = useState('')
  const [type, setType] = useState('pack_to_kg')
  const [input, setInput] = useState('')
  const [history, setHistory] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('products').select('id,name,pack_to_kg,kg_to_ton').eq('is_active', true).order('name')
      .then(({ data }) => setProducts(data || []))
    loadHistory()
  }, [])

  async function loadHistory() {
    const { data } = await supabase
      .from('stock_conversions')
      .select('*, products(name)')
      .order('created_at', { ascending: false })
      .limit(20)
    setHistory(data || [])
  }

  const product = products.find((p) => p.id === productId)

  function computeOutput() {
    if (!product) return 0
    const q = Number(input) || 0
    if (type === 'pack_to_kg') return q * (Number(product.pack_to_kg) || 0)
    if (type === 'kg_to_ton') return q / (Number(product.kg_to_ton) || 1000)
    if (type === 'ton_to_kg') return q * (Number(product.kg_to_ton) || 1000)
    return 0
  }

  const output = computeOutput()

  async function saveConversion(e) {
    e.preventDefault()
    if (!product) return
    setSaving(true)
    await supabase.from('stock_conversions').insert({
      product_id: product.id,
      conversion_type: type,
      input_quantity: Number(input) || 0,
      output_quantity: output,
      conversion_date: todayISO()
    })
    setInput('')
    setSaving(false)
    loadHistory()
  }

  return (
    <div>
      <PageHeader title="Stock Conversion" />
      <Card className="mb-6">
        <form onSubmit={saveConversion} className="flex flex-col gap-3">
          <Select label="Product" required value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Select a product…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select label="Conversion type" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <Input label="Input quantity" type="number" step="0.01" required value={input} onChange={(e) => setInput(e.target.value)} />
          {product && (
            <p className="text-sm text-ink/60">
              Rate used: {type === 'pack_to_kg' && `1 Pack = ${formatNumber(product.pack_to_kg)} KG`}
              {type !== 'pack_to_kg' && `1 Ton = ${formatNumber(product.kg_to_ton)} KG`}
            </p>
          )}
          <div className="bg-paper rounded-card p-3 text-center">
            <p className="text-xs text-ink/50">Result</p>
            <p className="font-display text-xl font-semibold tabular">{formatNumber(output)}</p>
          </div>
          <p className="text-xs text-ink/40">
            This calculator is a reference tool — it does not change stock on its own. Use "Add stock" / "Reduce stock" on the Products page, or record a Purchase/Sale, to actually change inventory.
          </p>
          <Button type="submit" disabled={!product || saving}>{saving ? 'Saving…' : 'Save to conversion log'}</Button>
        </form>
      </Card>

      <h2 className="font-display font-semibold mb-3">Recent conversions</h2>
      {history.length === 0 ? (
        <EmptyState title="No conversions logged yet" />
      ) : (
        <div className="bg-surface border border-line rounded-card divide-y divide-line">
          {history.map((h) => (
            <div key={h.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{h.products?.name}</p>
                <p className="text-xs text-ink/50">{TYPES.find((t) => t.value === h.conversion_type)?.label} · {formatDate(h.conversion_date)}</p>
              </div>
              <p className="tabular">{formatNumber(h.input_quantity)} → {formatNumber(h.output_quantity)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
