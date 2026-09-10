import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { Button, Input, Select, Modal, PageHeader, EmptyState, Badge } from '../components/ui.jsx'
import { formatINR, formatNumber, formatDate, todayISO, toBaseKG } from '../lib/format.js'
import { exportToCSV } from '../lib/csv.js'

const emptyForm = {
  supplier_id: '', product_id: '', quantity: '', unit: 'KG',
  purchase_price: '', paid_amount: '0', purchase_date: todayISO()
}

export default function Purchases() {
  const [rows, setRows] = useState([])
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')

  const load = useCallback(async () => {
    const [{ data: p }, { data: s }, { data: r }] = await Promise.all([
      supabase.from('products').select('*').eq('is_active', true).order('name'),
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('purchases').select('*, products(name,unit), suppliers(name)').order('purchase_date', { ascending: false }).order('created_at', { ascending: false }).limit(200)
    ])
    setProducts(p || [])
    setSuppliers(s || [])
    setRows(r || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('purchases-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  const selectedProduct = products.find((p) => p.id === form.product_id)
  const quantityInKg = useMemo(() => toBaseKG(form.quantity, form.unit, selectedProduct), [form.quantity, form.unit, selectedProduct])
  const total = (Number(form.quantity) || 0) * (Number(form.purchase_price) || 0)

  function openNew() {
    setForm(emptyForm)
    setFormOpen(true)
  }

  async function addSupplierQuick() {
    if (!newSupplierName.trim()) return
    const { data } = await supabase.from('suppliers').insert({ name: newSupplierName.trim() }).select().single()
    if (data) {
      setSuppliers((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setForm((f) => ({ ...f, supplier_id: data.id }))
      setNewSupplierName('')
    }
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    const paid = Number(form.paid_amount) || 0
    await supabase.from('purchases').insert({
      supplier_id: form.supplier_id || null,
      product_id: form.product_id,
      quantity: Number(form.quantity) || 0,
      unit: form.unit,
      quantity_in_kg: quantityInKg,
      purchase_price: Number(form.purchase_price) || 0,
      total_amount: total,
      paid_amount: paid,
      purchase_date: form.purchase_date
    })
    setSaving(false)
    setFormOpen(false)
    load()
  }

  async function removePurchase(row) {
    if (!confirm('Delete this purchase? Stock added by it will be reversed.')) return
    await supabase.from('purchases').delete().eq('id', row.id)
    load()
  }

  function handleExport() {
    exportToCSV('purchases.csv', rows.map((r) => ({
      Date: r.purchase_date,
      Supplier: r.suppliers?.name || '',
      Product: r.products?.name || '',
      Quantity: r.quantity,
      Unit: r.unit,
      'Purchase price': r.purchase_price,
      Total: r.total_amount,
      Paid: r.paid_amount,
      Pending: r.pending_amount
    })))
  }

  return (
    <div>
      <PageHeader
        title="Purchases"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>Export</Button>
            <Button onClick={openNew}>+ Purchase</Button>
          </div>
        }
      />

      {loading ? (
        <p className="text-ink/50 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No purchases recorded yet" hint="Tap '+ Purchase' to log a stock load." />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <div key={r.id} className="bg-surface border border-line rounded-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{r.products?.name || 'Deleted product'}</p>
                  <p className="text-xs text-ink/50">{r.suppliers?.name || 'No supplier'} · {formatDate(r.purchase_date)}</p>
                </div>
                {r.pending_amount > 0 && <Badge tone="danger">Pending {formatINR(r.pending_amount)}</Badge>}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                <div><p className="text-ink/40 text-xs">Qty</p><p className="tabular font-medium">{formatNumber(r.quantity)} {r.unit}</p></div>
                <div><p className="text-ink/40 text-xs">Total</p><p className="tabular font-medium">{formatINR(r.total_amount)}</p></div>
                <div><p className="text-ink/40 text-xs">Paid</p><p className="tabular font-medium">{formatINR(r.paid_amount)}</p></div>
              </div>
              <Button variant="danger" className="!px-3 !py-1.5 text-xs mt-3" onClick={() => removePurchase(r)}>Delete</Button>
            </div>
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Record purchase">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <Select label="Supplier" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
              <option value="">No supplier / cash purchase</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <div className="flex gap-2 mt-1.5">
              <Input placeholder="New supplier name" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} className="flex-1 !py-1.5 text-sm" />
              <Button type="button" variant="outline" className="!px-3 !py-1.5 text-xs" onClick={addSupplierQuick}>Add</Button>
            </div>
          </div>
          <Select label="Product" required value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
            <option value="">Select product…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Quantity" type="number" step="0.01" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            <Select label="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              <option value="KG">KG</option>
              <option value="Pack">Pack</option>
              <option value="Ton">Ton</option>
            </Select>
          </div>
          {selectedProduct && <p className="text-xs text-ink/50 -mt-2">= {formatNumber(quantityInKg)} KG added to stock</p>}
          <Input label="Purchase price (₹ per unit)" type="number" step="0.01" required value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
          <Input label="Date" type="date" required value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
          <div className="bg-paper rounded-card p-3 flex justify-between text-sm">
            <span className="text-ink/60">Total amount</span>
            <span className="font-semibold tabular">{formatINR(total)}</span>
          </div>
          <Input label="Paid amount now (₹)" type="number" step="0.01" value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} />
          <Button type="submit" disabled={saving || !form.product_id}>{saving ? 'Saving…' : 'Save purchase'}</Button>
        </form>
      </Modal>
    </div>
  )
}
