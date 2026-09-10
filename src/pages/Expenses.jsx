import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { Button, Input, Modal, PageHeader, EmptyState } from '../components/ui.jsx'
import { formatINR, formatDate, todayISO } from '../lib/format.js'
import { exportToCSV } from '../lib/csv.js'

const CATEGORIES = ['Transport', 'Labour', 'Electricity', 'Rent', 'Maintenance', 'Food', 'Other']

export default function Expenses() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ category: CATEGORIES[0], amount: '', description: '', expense_date: todayISO() })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false }).order('created_at', { ascending: false }).limit(300)
    setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('expenses-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('expenses').insert({ ...form, amount: Number(form.amount) || 0 })
    setSaving(false)
    setFormOpen(false)
    setForm({ category: CATEGORIES[0], amount: '', description: '', expense_date: todayISO() })
    load()
  }

  async function remove(row) {
    if (!confirm('Delete this expense?')) return
    await supabase.from('expenses').delete().eq('id', row.id)
    load()
  }

  function handleExport() {
    exportToCSV('expenses.csv', rows.map((r) => ({
      Date: r.expense_date, Category: r.category, Amount: r.amount, Description: r.description
    })))
  }

  const monthTotal = rows
    .filter((r) => r.expense_date?.slice(0, 7) === todayISO().slice(0, 7))
    .reduce((s, r) => s + Number(r.amount || 0), 0)

  return (
    <div>
      <PageHeader
        title="Expenses"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>Export</Button>
            <Button onClick={() => setFormOpen(true)}>+ Expense</Button>
          </div>
        }
      />
      <p className="text-sm text-ink/50 mb-4">This month's total: <strong className="text-ink">{formatINR(monthTotal)}</strong></p>

      {loading ? (
        <p className="text-ink/50 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No expenses recorded yet" />
      ) : (
        <div className="bg-surface border border-line rounded-card divide-y divide-line">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{r.category}</p>
                <p className="text-xs text-ink/50">{formatDate(r.expense_date)} {r.description ? `· ${r.description}` : ''}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium tabular">{formatINR(r.amount)}</span>
                <button onClick={() => remove(r)} className="text-danger text-xs">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Add expense">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink/70 font-medium">Category</span>
            <select className="border border-line rounded-card px-3 py-2.5" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <Input label="Amount (₹)" type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Date" type="date" required value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save expense'}</Button>
        </form>
      </Modal>
    </div>
  )
}
