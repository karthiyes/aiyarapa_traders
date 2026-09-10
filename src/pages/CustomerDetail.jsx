import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Button, Input, Modal, Card, EmptyState, Badge } from '../components/ui.jsx'
import { formatINR, formatNumber, formatDate, todayISO } from '../lib/format.js'

export default function CustomerDetail() {
  const { id } = useParams()
  const [customer, setCustomer] = useState(null)
  const [sales, setSales] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [payModal, setPayModal] = useState(null) // sale row or 'general'
  const [payForm, setPayForm] = useState({ amount: '', note: '', payment_date: todayISO() })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [{ data: c }, { data: s }, { data: p }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', id).single(),
      supabase.from('sales').select('*, products(name)').eq('customer_id', id).order('sale_date', { ascending: false }),
      supabase.from('customer_payments').select('*').eq('customer_id', id).order('payment_date', { ascending: false })
    ])
    setCustomer(c)
    setSales(s || [])
    setPayments(p || [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`customer-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `customer_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_payments', filter: `customer_id=eq.${id}` }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id, load])

  const totals = sales.reduce((acc, s) => ({
    total: acc.total + Number(s.total_amount || 0),
    paid: acc.paid + Number(s.paid_amount || 0),
    pending: acc.pending + Number(s.pending_amount || 0)
  }), { total: 0, paid: 0, pending: 0 })

  function openPay(sale) {
    setPayModal(sale)
    setPayForm({ amount: sale ? sale.pending_amount : '', note: '', payment_date: todayISO() })
  }

  async function submitPayment(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('customer_payments').insert({
      customer_id: id,
      sale_id: payModal && payModal !== 'general' ? payModal.id : null,
      amount: Number(payForm.amount) || 0,
      note: payForm.note,
      payment_date: payForm.payment_date
    })
    setSaving(false)
    setPayModal(null)
    load()
  }

  if (loading) return <p className="text-ink/50 text-sm">Loading…</p>
  if (!customer) return <EmptyState title="Customer not found" />

  return (
    <div>
      <Link to="/customers" className="text-sm text-primary">← Back to customers</Link>
      <div className="flex items-center justify-between mt-2 mb-4">
        <div>
          <h1 className="text-xl font-display font-semibold">{customer.name}</h1>
          <p className="text-sm text-ink/50">{customer.area || 'No area'} {customer.phone ? `· ${customer.phone}` : ''}</p>
        </div>
        <Button onClick={() => openPay('general')}>Collect payment</Button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card><p className="text-xs text-ink/50">Total purchases</p><p className="font-semibold tabular">{formatINR(totals.total)}</p></Card>
        <Card><p className="text-xs text-ink/50">Total paid</p><p className="font-semibold tabular text-success">{formatINR(totals.paid)}</p></Card>
        <Card><p className="text-xs text-ink/50">Pending</p><p className={`font-semibold tabular ${totals.pending > 0 ? 'text-danger' : ''}`}>{formatINR(totals.pending)}</p></Card>
      </div>

      <h2 className="font-display font-semibold mb-3">Purchase history</h2>
      {sales.length === 0 ? (
        <EmptyState title="No purchases from this customer yet" />
      ) : (
        <div className="flex flex-col gap-2 mb-6">
          {sales.map((s) => (
            <div key={s.id} className="bg-surface border border-line rounded-card p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{s.products?.name}</p>
                <p className="text-xs text-ink/50">{formatDate(s.sale_date)} · {formatNumber(s.quantity)} {s.unit} · {formatINR(s.total_amount)}</p>
              </div>
              {s.pending_amount > 0 ? (
                <Button variant="outline" className="!px-3 !py-1.5 text-xs" onClick={() => openPay(s)}>Collect {formatINR(s.pending_amount)}</Button>
              ) : (
                <Badge tone="good">Paid</Badge>
              )}
            </div>
          ))}
        </div>
      )}

      <h2 className="font-display font-semibold mb-3">Payment history</h2>
      {payments.length === 0 ? (
        <EmptyState title="No payments collected yet" />
      ) : (
        <div className="bg-surface border border-line rounded-card divide-y divide-line">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{formatINR(p.amount)}</p>
                <p className="text-xs text-ink/50">{formatDate(p.payment_date)} {p.note ? `· ${p.note}` : ''}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Collect payment">
        <form onSubmit={submitPayment} className="flex flex-col gap-3">
          <Input label="Amount (₹)" type="number" step="0.01" required autoFocus value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
          <Input label="Date" type="date" required value={payForm.payment_date} onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })} />
          <Input label="Note (optional)" value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} />
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Record payment'}</Button>
        </form>
      </Modal>
    </div>
  )
}
