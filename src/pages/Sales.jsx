import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { Button, Input, Select, Modal, PageHeader, EmptyState, Badge } from '../components/ui.jsx'
import { formatINR, formatNumber, formatDate, todayISO, toBaseKG } from '../lib/format.js'
import { exportToCSV } from '../lib/csv.js'

const emptyForm = {
  customer_id: '', product_id: '', quantity: '', unit: 'KG',
  selling_price: '', paid_amount: '', sale_date: todayISO()
}

export default function Sales() {
  const [rows, setRows] = useState([])
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')

  const load = useCallback(async () => {
    const [{ data: p }, { data: c }, { data: r }] = await Promise.all([
      supabase.from('products').select('*').eq('is_active', true).order('name'),
      supabase.from('customers').select('*').order('name'),
      supabase.from('sales').select('*, products(name,unit), customers(name)').order('sale_date', { ascending: false }).order('created_at', { ascending: false }).limit(200)
    ])
    setProducts(p || [])
    setCustomers(c || [])
    setRows(r || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('sales-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  const selectedProduct = products.find((p) => p.id === form.product_id)
  const quantityInKg = useMemo(() => toBaseKG(form.quantity, form.unit, selectedProduct), [form.quantity, form.unit, selectedProduct])
  const total = (Number(form.quantity) || 0) * (Number(form.selling_price) || 0)
  const paid = form.paid_amount === '' ? total : Number(form.paid_amount)
  const pending = total - paid

  function openNew() {
    setForm(emptyForm)
    setError('')
    setFormOpen(true)
  }

  function selectProduct(id) {
    const prod = products.find((p) => p.id === id)
    setForm((f) => ({ ...f, product_id: id, selling_price: prod ? prod.selling_price : f.selling_price, unit: prod ? prod.unit : f.unit }))
  }

  async function addCustomerQuick() {
    if (!newCustomerName.trim()) return
    const { data } = await supabase.from('customers').insert({ name: newCustomerName.trim() }).select().single()
    if (data) {
      setCustomers((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setForm((f) => ({ ...f, customer_id: data.id }))
      setNewCustomerName('')
    }
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (selectedProduct && quantityInKg > Number(selectedProduct.current_stock)) {
      setError(`Only ${formatNumber(selectedProduct.current_stock)} KG in stock. Reduce the quantity or add stock first.`)
      return
    }
    setSaving(true)
    await supabase.from('sales').insert({
      customer_id: form.customer_id || null,
      product_id: form.product_id,
      quantity: Number(form.quantity) || 0,
      unit: form.unit,
      quantity_in_kg: quantityInKg,
      selling_price: Number(form.selling_price) || 0,
      total_amount: total,
      paid_amount: paid,
      sale_date: form.sale_date
    })
    setSaving(false)
    setFormOpen(false)
    load()
  }

  async function removeSale(row) {
    if (!confirm('Delete this sale? Stock will be restored.')) return
    await supabase.from('sales').delete().eq('id', row.id)
    load()
  }

  function handleExport() {
    exportToCSV('sales.csv', rows.map((r) => ({
      Date: r.sale_date,
      Customer: r.customers?.name || '',
      Product: r.products?.name || '',
      Quantity: r.quantity,
      Unit: r.unit,
      'Selling price': r.selling_price,
      Total: r.total_amount,
      Paid: r.paid_amount,
      Pending: r.pending_amount
    })))
  }

  return (
    <div>
      <PageHeader
        title="Sales"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>Export</Button>
            <Button onClick={openNew}>+ Sale</Button>
          </div>
        }
      />

      {loading ? (
        <p className="text-ink/50 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No sales recorded yet" hint="Tap '+ Sale' to record your first sale." />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <div key={r.id} className="bg-surface border border-line rounded-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{r.products?.name || 'Deleted product'}</p>
                  <p className="text-xs text-ink/50">{r.customers?.name || 'Walk-in'} · {formatDate(r.sale_date)}</p>
                </div>
                {r.pending_amount > 0 && <Badge tone="danger">Pending {formatINR(r.pending_amount)}</Badge>}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                <div><p className="text-ink/40 text-xs">Qty</p><p className="tabular font-medium">{formatNumber(r.quantity)} {r.unit}</p></div>
                <div><p className="text-ink/40 text-xs">Total</p><p className="tabular font-medium">{formatINR(r.total_amount)}</p></div>
                <div><p className="text-ink/40 text-xs">Paid</p><p className="tabular font-medium">{formatINR(r.paid_amount)}</p></div>
              </div>
              <Button variant="danger" className="!px-3 !py-1.5 text-xs mt-3" onClick={() => removeSale(r)}>Delete</Button>
            </div>
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Record sale">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <Select label="Customer" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
              <option value="">Walk-in customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <div className="flex gap-2 mt-1.5">
              <Input placeholder="New customer name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} className="flex-1 !py-1.5 text-sm" />
              <Button type="button" variant="outline" className="!px-3 !py-1.5 text-xs" onClick={addCustomerQuick}>Add</Button>
            </div>
          </div>
          <Select label="Product" required value={form.product_id} onChange={(e) => selectProduct(e.target.value)}>
            <option value="">Select product…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({formatNumber(p.current_stock)} KG in stock)</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Quantity" type="number" step="0.01" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            <Select label="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              <option value="KG">KG</option>
              <option value="Pack">Pack</option>
              <option value="Ton">Ton</option>
            </Select>
          </div>
          {selectedProduct && <p className="text-xs text-ink/50 -mt-2">= {formatNumber(quantityInKg)} KG from stock</p>}
          <Input label="Selling price (₹ per unit)" type="number" step="0.01" required value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
          <Input label="Date" type="date" required value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} />
          <div className="bg-paper rounded-card p-3 flex justify-between text-sm">
            <span className="text-ink/60">Total amount</span>
            <span className="font-semibold tabular">{formatINR(total)}</span>
          </div>
          <Input label="Paid amount now (₹)" type="number" step="0.01" placeholder={String(total)} value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} />
          <p className="text-xs text-ink/50">Pending after this sale: <strong className={pending > 0 ? 'text-danger' : 'text-success'}>{formatINR(pending)}</strong></p>
          {error && <p className="text-danger text-sm">{error}</p>}
          <Button type="submit" disabled={saving || !form.product_id}>{saving ? 'Saving…' : 'Save sale'}</Button>
        </form>
      </Modal>
    </div>
  )
}
