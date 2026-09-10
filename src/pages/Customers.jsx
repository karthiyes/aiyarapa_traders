import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Button, Input, Modal, PageHeader, EmptyState, Badge } from '../components/ui.jsx'
import { formatINR } from '../lib/format.js'

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ name: '', area: '', phone: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data: cust } = await supabase.from('customers').select('*').order('name')
    const { data: sales } = await supabase.from('sales').select('customer_id,total_amount,paid_amount,pending_amount')
    const summary = {}
    for (const s of sales || []) {
      if (!s.customer_id) continue
      if (!summary[s.customer_id]) summary[s.customer_id] = { total: 0, paid: 0, pending: 0 }
      summary[s.customer_id].total += Number(s.total_amount || 0)
      summary[s.customer_id].paid += Number(s.paid_amount || 0)
      summary[s.customer_id].pending += Number(s.pending_amount || 0)
    }
    setCustomers((cust || []).map((c) => ({ ...c, ...(summary[c.id] || { total: 0, paid: 0, pending: 0 }) })))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('customers-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('customers').insert(form)
    setSaving(false)
    setFormOpen(false)
    setForm({ name: '', area: '', phone: '' })
    load()
  }

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || (c.area || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <PageHeader title="Customers" action={<Button onClick={() => setFormOpen(true)}>+ Add customer</Button>} />
      <Input placeholder="Search by name or area…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4 w-full" />

      {loading ? (
        <p className="text-ink/50 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="No customers yet" hint="Add a customer here, or while recording a sale." />
      ) : (
        <div className="bg-surface border border-line rounded-card divide-y divide-line">
          {filtered.map((c) => (
            <Link key={c.id} to={`/customers/${c.id}`} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium text-sm">{c.name}</p>
                <p className="text-xs text-ink/50">{c.area || 'No area'} {c.phone ? `· ${c.phone}` : ''}</p>
              </div>
              {c.pending > 0 ? <Badge tone="danger">{formatINR(c.pending)} due</Badge> : <Badge tone="good">Settled</Badge>}
            </Link>
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Add customer">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Area / Village" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
          <Input label="Phone number" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save customer'}</Button>
        </form>
      </Modal>
    </div>
  )
}
