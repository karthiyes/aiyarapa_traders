import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { Button, Input, Select, Modal, PageHeader, EmptyState, Badge } from '../components/ui.jsx'
import { formatNumber, formatDate, todayISO } from '../lib/format.js'

export default function StockAdjustments() {
  const [rows, setRows] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ product_id: '', change_type: 'increase', quantity_kg: '', reason: '', adjustment_date: todayISO() })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from('products').select('id,name').eq('is_active', true).order('name'),
      supabase.from('stock_adjustments').select('*, products(name)').order('adjustment_date', { ascending: false }).order('created_at', { ascending: false }).limit(200)
    ])
    setProducts(p || [])
    setRows(r || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('adjustments-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_adjustments' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('stock_adjustments').insert({
      ...form,
      quantity_kg: Number(form.quantity_kg) || 0
    })
    setSaving(false)
    setFormOpen(false)
    setForm({ product_id: '', change_type: 'increase', quantity_kg: '', reason: '', adjustment_date: todayISO() })
    load()
  }

  return (
    <div>
      <PageHeader title="Stock Adjustments" action={<Button onClick={() => setFormOpen(true)}>+ Adjustment</Button>} />
      <p className="text-sm text-ink/50 mb-4">Use this for stock corrections that aren't a purchase or sale — damage, spillage, manual recount, etc. Every entry is kept as a permanent history.</p>

      {loading ? (
        <p className="text-ink/50 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No adjustments recorded yet" />
      ) : (
        <div className="bg-surface border border-line rounded-card divide-y divide-line">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{r.products?.name}</p>
                <p className="text-xs text-ink/50">{formatDate(r.adjustment_date)} {r.reason ? `· ${r.reason}` : ''}</p>
              </div>
              <Badge tone={r.change_type === 'increase' ? 'good' : 'danger'}>
                {r.change_type === 'increase' ? '+' : '−'}{formatNumber(r.quantity_kg)} KG
              </Badge>
            </div>
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Record stock adjustment">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Select label="Product" required value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
            <option value="">Select product…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select label="Type" value={form.change_type} onChange={(e) => setForm({ ...form, change_type: e.target.value })}>
            <option value="increase">Increase stock</option>
            <option value="decrease">Decrease stock</option>
          </Select>
          <Input label="Quantity (KG)" type="number" step="0.01" required value={form.quantity_kg} onChange={(e) => setForm({ ...form, quantity_kg: e.target.value })} />
          <Input label="Reason" required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Damaged in transit, Recount correction" />
          <Input label="Date" type="date" required value={form.adjustment_date} onChange={(e) => setForm({ ...form, adjustment_date: e.target.value })} />
          <Button type="submit" disabled={saving || !form.product_id}>{saving ? 'Saving…' : 'Save adjustment'}</Button>
        </form>
      </Modal>
    </div>
  )
}
