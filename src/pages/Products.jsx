import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { Button, Input, Select, Modal, PageHeader, EmptyState, Badge } from '../components/ui.jsx'
import { formatINR, formatNumber, todayISO } from '../lib/format.js'

const emptyForm = {
  name: '', category: '', unit: 'KG', pack_to_kg: '', kg_to_ton: 1000,
  buying_price: '', selling_price: '', current_stock: '0', min_stock_level: ''
}

export default function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [stockModal, setStockModal] = useState(null) // { product, mode: 'increase' | 'decrease' }
  const [stockForm, setStockForm] = useState({ quantity_kg: '', reason: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name')
    if (!error) setProducts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('products-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  function openEdit(p) {
    setEditing(p)
    setForm({
      name: p.name, category: p.category || '', unit: p.unit,
      pack_to_kg: p.pack_to_kg ?? '', kg_to_ton: p.kg_to_ton ?? 1000,
      buying_price: p.buying_price, selling_price: p.selling_price,
      current_stock: p.current_stock, min_stock_level: p.min_stock_level
    })
    setFormOpen(true)
  }

  async function saveProduct(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || 'General',
      unit: form.unit,
      pack_to_kg: Number(form.pack_to_kg) || 0,
      kg_to_ton: Number(form.kg_to_ton) || 1000,
      buying_price: Number(form.buying_price) || 0,
      selling_price: Number(form.selling_price) || 0,
      min_stock_level: Number(form.min_stock_level) || 0
    }
    if (editing) {
      await supabase.from('products').update(payload).eq('id', editing.id)
    } else {
      payload.current_stock = Number(form.current_stock) || 0
      await supabase.from('products').insert(payload)
    }
    setSaving(false)
    setFormOpen(false)
    load()
  }

  async function deleteProduct(p) {
    if (!confirm(`Delete "${p.name}"? This hides it from lists but keeps past sales/purchase history.`)) return
    await supabase.from('products').update({ is_active: false }).eq('id', p.id)
    load()
  }

  function openStock(product, mode) {
    setStockModal({ product, mode })
    setStockForm({ quantity_kg: '', reason: '' })
  }

  async function submitStock(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('stock_adjustments').insert({
      product_id: stockModal.product.id,
      change_type: stockModal.mode,
      quantity_kg: Number(stockForm.quantity_kg) || 0,
      reason: stockForm.reason || (stockModal.mode === 'increase' ? 'Stock added' : 'Stock reduced'),
      adjustment_date: todayISO()
    })
    setSaving(false)
    setStockModal(null)
    load()
  }

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <PageHeader
        title="Products"
        action={<Button onClick={openNew}>+ Add product</Button>}
      />

      <Input
        placeholder="Search products or category…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full"
      />

      {loading ? (
        <p className="text-ink/50 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="No products yet" hint="Tap 'Add product' to create your first item." />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((p) => {
            const low = Number(p.current_stock) <= Number(p.min_stock_level)
            return (
              <div key={p.id} className="bg-surface border border-line rounded-card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-ink/50">{p.category} · Base unit KG</p>
                  </div>
                  {low && <Badge tone="danger">Low stock</Badge>}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                  <div>
                    <p className="text-ink/40 text-xs">Stock</p>
                    <p className="tabular font-medium">{formatNumber(p.current_stock)} KG</p>
                  </div>
                  <div>
                    <p className="text-ink/40 text-xs">Buying</p>
                    <p className="tabular font-medium">{formatINR(p.buying_price)}</p>
                  </div>
                  <div>
                    <p className="text-ink/40 text-xs">Selling</p>
                    <p className="tabular font-medium">{formatINR(p.selling_price)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button variant="outline" className="!px-3 !py-1.5 text-xs" onClick={() => openStock(p, 'increase')}>+ Add stock</Button>
                  <Button variant="outline" className="!px-3 !py-1.5 text-xs" onClick={() => openStock(p, 'decrease')}>− Reduce stock</Button>
                  <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => openEdit(p)}>Edit</Button>
                  <Button variant="danger" className="!px-3 !py-1.5 text-xs" onClick={() => deleteProduct(p)}>Delete</Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit product' : 'Add product'}>
        <form onSubmit={saveProduct} className="flex flex-col gap-3">
          <Input label="Product name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Fertilizer, Seeds, Feed" />
          <Select label="Primary selling unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
            <option value="KG">KG</option>
            <option value="Pack">Pack</option>
            <option value="Ton">Ton</option>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="1 Pack = ? KG" type="number" step="0.01" value={form.pack_to_kg} onChange={(e) => setForm({ ...form, pack_to_kg: e.target.value })} placeholder="e.g. 50" />
            <Input label="1 Ton = ? KG" type="number" step="0.01" value={form.kg_to_ton} onChange={(e) => setForm({ ...form, kg_to_ton: e.target.value })} placeholder="1000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Buying price (₹)" type="number" step="0.01" required value={form.buying_price} onChange={(e) => setForm({ ...form, buying_price: e.target.value })} />
            <Input label="Selling price (₹)" type="number" step="0.01" required value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!editing && (
              <Input label="Opening stock (KG)" type="number" step="0.01" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} />
            )}
            <Input label="Minimum stock level (KG)" type="number" step="0.01" value={form.min_stock_level} onChange={(e) => setForm({ ...form, min_stock_level: e.target.value })} />
          </div>
          <Button type="submit" disabled={saving} className="mt-2">{saving ? 'Saving…' : 'Save product'}</Button>
        </form>
      </Modal>

      <Modal open={!!stockModal} onClose={() => setStockModal(null)} title={stockModal?.mode === 'increase' ? 'Add stock' : 'Reduce stock'}>
        {stockModal && (
          <form onSubmit={submitStock} className="flex flex-col gap-3">
            <p className="text-sm text-ink/60">{stockModal.product.name} — current: {formatNumber(stockModal.product.current_stock)} KG</p>
            <Input label="Quantity (KG)" type="number" step="0.01" required autoFocus value={stockForm.quantity_kg} onChange={(e) => setStockForm({ ...stockForm, quantity_kg: e.target.value })} />
            <Input label="Reason" value={stockForm.reason} onChange={(e) => setStockForm({ ...stockForm, reason: e.target.value })} placeholder="e.g. Damaged goods, Manual count correction" />
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Confirm'}</Button>
          </form>
        )}
      </Modal>
    </div>
  )
}
