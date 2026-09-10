import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Button, Input, Modal, Card, EmptyState, Badge } from '../components/ui.jsx'
import { formatINR, formatNumber, formatDate, todayISO } from '../lib/format.js'

export default function SupplierDetail() {
  const { id } = useParams()
  const [supplier, setSupplier] = useState(null)
  const [purchases, setPurchases] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [payModal, setPayModal] = useState(null)
  const [payForm, setPayForm] = useState({ amount: '', note: '', payment_date: todayISO() })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [{ data: s }, { data: p }, { data: pay }] = await Promise.all([
      supabase.from('suppliers').select('*').eq('id', id).single(),
      supabase.from('purchases').select('*, products(name)').eq('supplier_id', id).order('purchase_date', { ascending: false }),
      supabase.from('supplier_payments').select('*').eq('supplier_id', id).order('payment_date', { ascending: false })
    ])
    setSupplier(s)
    setPurchases(p || [])
    setPayments(pay || [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`supplier-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases', filter: `supplier_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_payments', filter: `supplier_id=eq.${id}` }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id, load])

  const totals = purchases.reduce((acc, p) => ({
    total: acc.total + Number(p.total_amount || 0),
    paid: acc.paid + Number(p.paid_amount || 0),
    pending: acc.pending + Number(p.pending_amount || 0)
  }), { total: 0, paid: 0, pending: 0 })

  function openPay(purchase) {
    setPayModal(purchase)
    setPayForm({ amount: purchase ? purchase.pending_amount : '', note: '', payment_date: todayISO() })
  }

  async function submitPayment(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('supplier_payments').insert({
      supplier_id: id,
      purchase_id: payModal && payModal !== 'general' ? payModal.id : null,
      amount: Number(payForm.amount) || 0,
      note: payForm.note,
      payment_date: payForm.payment_date
    })
    setSaving(false)
    setPayModal(null)
    load()
  }

  if (loading) return <p className="text-ink/50 text-sm">Loading…</p>
  if (!supplier) return <EmptyState title="Supplier not found" />

  return (
    <div>
      <Link to="/suppliers" className="text-sm text-primary">← Back to suppliers</Link>
      <div className="flex items-center justify-between mt-2 mb-4">
        <div>
          <h1 className="text-xl font-display font-semibold">{supplier.name}</h1>
          <p className="text-sm text-ink/50">{supplier.area || 'No area'} {supplier.phone ? `· ${supplier.phone}` : ''}</p>
        </div>
        <Button onClick={() => openPay('general')}>Pay supplier</Button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card><p className="text-xs text-ink/50">Total purchases</p><p className="font-semibold tabular">{formatINR(totals.total)}</p></Card>
        <Card><p className="text-xs text-ink/50">Total paid</p><p className="font-semibold tabular text-success">{formatINR(totals.paid)}</p></Card>
        <Card><p className="text-xs text-ink/50">Pending (we owe)</p><p className={`font-semibold tabular ${totals.pending > 0 ? 'text-danger' : ''}`}>{formatINR(totals.pending)}</p></Card>
      </div>

      <h2 className="font-display font-semibold mb-3">Purchase history</h2>
      {purchases.length === 0 ? (
        <EmptyState title="No purchases from this supplier yet" />
      ) : (
        <div className="flex flex-col gap-2 mb-6">
          {purchases.map((p) => (
            <div key={p.id} className="bg-surface border border-line rounded-card p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{p.products?.name}</p>
                <p className="text-xs text-ink/50">{formatDate(p.purchase_date)} · {formatNumber(p.quantity)} {p.unit} · {formatINR(p.total_amount)}</p>
              </div>
              {p.pending_amount > 0 ? (
                <Button variant="outline" className="!px-3 !py-1.5 text-xs" onClick={() => openPay(p)}>Pay {formatINR(p.pending_amount)}</Button>
              ) : (
                <Badge tone="good">Paid</Badge>
              )}
            </div>
          ))}
        </div>
      )}

      <h2 className="font-display font-semibold mb-3">Payment history</h2>
      {payments.length === 0 ? (
        <EmptyState title="No payments made yet" />
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

      <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Pay supplier">
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
