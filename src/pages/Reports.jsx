import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Button, Select, PageHeader, EmptyState, Card } from '../components/ui.jsx'
import { formatINR, formatNumber, formatDate, todayISO, monthStartISO } from '../lib/format.js'
import { exportToCSV } from '../lib/csv.js'

const REPORTS = [
  { value: 'daily_sales', label: 'Daily sales' },
  { value: 'monthly_sales', label: 'Monthly sales' },
  { value: 'purchases', label: 'Purchases' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'pending', label: 'Pending customer payments' },
  { value: 'stock', label: 'Stock report' },
  { value: 'profit', label: 'Profit estimate' }
]

export default function Reports() {
  const [report, setReport] = useState('daily_sales')
  const [from, setFrom] = useState(monthStartISO())
  const [to, setTo] = useState(todayISO())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, from, to])

  async function load() {
    setLoading(true)
    setSummary(null)
    try {
      if (report === 'daily_sales' || report === 'monthly_sales') {
        const { data } = await supabase
          .from('sales')
          .select('*, products(name), customers(name)')
          .gte('sale_date', report === 'daily_sales' ? to : from)
          .lte('sale_date', to)
          .order('sale_date', { ascending: false })
        setRows(data || [])
        const total = (data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0)
        const pending = (data || []).reduce((s, r) => s + Number(r.pending_amount || 0), 0)
        setSummary({ 'Total sales': formatINR(total), 'Pending from these sales': formatINR(pending), 'Number of sales': (data || []).length })
      }

      if (report === 'purchases') {
        const { data } = await supabase
          .from('purchases')
          .select('*, products(name), suppliers(name)')
          .gte('purchase_date', from)
          .lte('purchase_date', to)
          .order('purchase_date', { ascending: false })
        setRows(data || [])
        const total = (data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0)
        setSummary({ 'Total purchases': formatINR(total), 'Number of purchases': (data || []).length })
      }

      if (report === 'expenses') {
        const { data } = await supabase
          .from('expenses')
          .select('*')
          .gte('expense_date', from)
          .lte('expense_date', to)
          .order('expense_date', { ascending: false })
        setRows(data || [])
        const total = (data || []).reduce((s, r) => s + Number(r.amount || 0), 0)
        setSummary({ 'Total expenses': formatINR(total) })
      }

      if (report === 'pending') {
        const { data } = await supabase
          .from('sales')
          .select('*, products(name), customers(name)')
          .gt('pending_amount', 0)
          .order('sale_date', { ascending: false })
        setRows(data || [])
        const total = (data || []).reduce((s, r) => s + Number(r.pending_amount || 0), 0)
        setSummary({ 'Total pending': formatINR(total), 'Sales with dues': (data || []).length })
      }

      if (report === 'stock') {
        const { data } = await supabase.from('products').select('*').eq('is_active', true).order('name')
        setRows(data || [])
        const stockValue = (data || []).reduce((s, r) => s + Number(r.current_stock || 0) * Number(r.buying_price || 0), 0)
        setSummary({ 'Total stock value (at buying price)': formatINR(stockValue), 'Products': (data || []).length })
      }

      if (report === 'profit') {
        const { data } = await supabase
          .from('sales')
          .select('quantity_in_kg, total_amount, product_id, sale_date, products(name, buying_price)')
          .gte('sale_date', from)
          .lte('sale_date', to)
        const withCost = (data || []).map((r) => {
          const cost = Number(r.quantity_in_kg || 0) * Number(r.products?.buying_price || 0)
          return { ...r, cost, profit: Number(r.total_amount || 0) - cost }
        })
        setRows(withCost)
        const revenue = withCost.reduce((s, r) => s + Number(r.total_amount || 0), 0)
        const cost = withCost.reduce((s, r) => s + r.cost, 0)
        setSummary({ Revenue: formatINR(revenue), 'Estimated cost': formatINR(cost), 'Estimated profit': formatINR(revenue - cost) })
      }
    } finally {
      setLoading(false)
    }
  }

  function handleExport() {
    let data = []
    if (report === 'daily_sales' || report === 'monthly_sales') {
      data = rows.map((r) => ({ Date: r.sale_date, Customer: r.customers?.name, Product: r.products?.name, Qty: r.quantity, Unit: r.unit, Total: r.total_amount, Paid: r.paid_amount, Pending: r.pending_amount }))
    } else if (report === 'purchases') {
      data = rows.map((r) => ({ Date: r.purchase_date, Supplier: r.suppliers?.name, Product: r.products?.name, Qty: r.quantity, Unit: r.unit, Total: r.total_amount, Paid: r.paid_amount, Pending: r.pending_amount }))
    } else if (report === 'expenses') {
      data = rows.map((r) => ({ Date: r.expense_date, Category: r.category, Amount: r.amount, Description: r.description }))
    } else if (report === 'pending') {
      data = rows.map((r) => ({ Date: r.sale_date, Customer: r.customers?.name, Product: r.products?.name, Pending: r.pending_amount }))
    } else if (report === 'stock') {
      data = rows.map((r) => ({ Product: r.name, Category: r.category, Stock_KG: r.current_stock, MinLevel_KG: r.min_stock_level, BuyingPrice: r.buying_price, SellingPrice: r.selling_price }))
    } else if (report === 'profit') {
      data = rows.map((r) => ({ Date: r.sale_date, Product: r.products?.name, Revenue: r.total_amount, Cost: r.cost.toFixed(2), Profit: r.profit.toFixed(2) }))
    }
    exportToCSV(`${report}.csv`, data)
  }

  const needsDateRange = report !== 'stock' && report !== 'pending'

  return (
    <div>
      <PageHeader title="Reports" action={<Button variant="outline" onClick={handleExport} disabled={rows.length === 0}>Export CSV</Button>} />

      <Card className="mb-4 flex flex-col gap-3">
        <Select label="Report type" value={report} onChange={(e) => setReport(e.target.value)}>
          {REPORTS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </Select>
        {needsDateRange && report !== 'daily_sales' && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink/70 font-medium">From</span>
              <input type="date" className="border border-line rounded-card px-3 py-2.5" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink/70 font-medium">To</span>
              <input type="date" className="border border-line rounded-card px-3 py-2.5" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
        )}
        {report === 'daily_sales' && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink/70 font-medium">Date</span>
            <input type="date" className="border border-line rounded-card px-3 py-2.5" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        )}
      </Card>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {Object.entries(summary).map(([k, v]) => (
            <Card key={k}><p className="text-xs text-ink/50">{k}</p><p className="font-semibold tabular">{v}</p></Card>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-ink/50 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No data for this selection" />
      ) : (
        <div className="bg-surface border border-line rounded-card divide-y divide-line">
          {report !== 'stock' && rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{r.products?.name || r.category || '—'}</p>
                <p className="text-xs text-ink/50">
                  {formatDate(r.sale_date || r.purchase_date || r.expense_date)}
                  {r.customers?.name ? ` · ${r.customers.name}` : ''}
                  {r.suppliers?.name ? ` · ${r.suppliers.name}` : ''}
                </p>
              </div>
              <p className="font-medium tabular">
                {formatINR(r.total_amount ?? r.amount ?? r.pending_amount ?? r.profit ?? 0)}
              </p>
            </div>
          ))}
          {report === 'stock' && rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-ink/50">{r.category}</p>
              </div>
              <p className="font-medium tabular">{formatNumber(r.current_stock)} KG</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
