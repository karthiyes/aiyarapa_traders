import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Button, Input, Modal, PageHeader, EmptyState, Badge } from '../components/ui.jsx'
import { formatINR } from '../lib/format.js'

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ name: '', area: '', phone: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data: sup } = await supabase.from('suppliers').select('*').order('name')
    const { data: purchases } = await supabase.from('purchases').select('supplier_id,total_amount,paid_amount,pending_amount')
    const summary = {}
    for (const p of purchases || []) {
      if (!p.supplier_id) continue
      if (!summary[p.supplier_id]) summary[p.supplier_id] = { total: 0, paid: 0, pending: 0 }
      summary[p.supplier_id].total += Number(p.total_amount || 0)
      summary[p.supplier_id].paid += Number(p.paid_amount || 0)
      summary[p.supplier_id].pending += Number(p.pending_amount || 0)
    }
    setSuppliers((sup || []).map((s) => ({ ...s, ...(summary[s.id] || { total: 0, paid: 0, pending: 0 }) })))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('suppliers-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('suppliers').insert(form)
    setSaving(false)
    setFormOpen(false)
    setForm({ name: '', area: '', phone: '' })
    load()
  }

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) || (s.area || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <PageHeader title="Suppliers" action={<Button onClick={() => setFormOpen(true)}>+ Add supplier</Button>} />
      <Input placeholder="Search by name or area…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4 w-full" />

      {loading ? (
        <p className="text-ink/50 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="No suppliers yet" hint="Add a supplier here, or while recording a purchase." />
      ) : (
        <div className="bg-surface border border-line rounded-card divide-y divide-line">
          {filtered.map((s) => (
            <Link key={s.id} to={`/suppliers/${s.id}`} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium text-sm">{s.name}</p>
                <p className="text-xs text-ink/50">{s.area || 'No area'} {s.phone ? `· ${s.phone}` : ''}</p>
              </div>
              {s.pending > 0 ? <Badge tone="danger">{formatINR(s.pending)} owed</Badge> : <Badge tone="good">Settled</Badge>}
            </Link>
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Add supplier">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Area" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
          <Input label="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save supplier'}</Button>
        </form>
      </Modal>
    </div>
  )
}
