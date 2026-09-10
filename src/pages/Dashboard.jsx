import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { StatCard, PageHeader, EmptyState, Badge } from '../components/ui.jsx'
import { formatINR, formatNumber, todayISO } from '../lib/format.js'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [lowStock, setLowStock] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const today = todayISO()

    const [
      { count: totalProducts },
      { data: products },
      { data: todaySales },
      { data: todayExpenses },
      { data: pendingSales }
    ] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('products').select('id,name,current_stock,min_stock_level,unit').eq('is_active', true),
      supabase.from('sales').select('total_amount').eq('sale_date', today),
      supabase.from('expenses').select('amount').eq('expense_date', today),
      supabase.from('sales').select('pending_amount').gt('pending_amount', 0)
    ])

    const totalStock = (products || []).reduce((s, p) => s + Number(p.current_stock || 0), 0)
    const low = (products || []).filter((p) => Number(p.current_stock) <= Number(p.min_stock_level))
    const todaySalesTotal = (todaySales || []).reduce((s, r) => s + Number(r.total_amount || 0), 0)
    const todayExpenseTotal = (todayExpenses || []).reduce((s, r) => s + Number(r.amount || 0), 0)
    const pendingTotal = (pendingSales || []).reduce((s, r) => s + Number(r.pending_amount || 0), 0)

    setStats({
      totalProducts: totalProducts || 0,
      totalStock,
      todaySalesTotal,
      todayExpenseTotal,
      pendingTotal,
      lowCount: low.length
    })
    setLowStock(low)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  if (loading) return <p className="text-ink/50 text-sm">Loading dashboard…</p>

  return (
    <div>
      <PageHeader title="Dashboard" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Total products" value={stats.totalProducts} />
        <StatCard label="Current stock (KG)" value={formatNumber(stats.totalStock)} />
        <StatCard
          label="Low-stock products"
          value={stats.lowCount}
          tone={stats.lowCount > 0 ? 'warn' : 'good'}
        />
        <StatCard label="Today's sales" value={formatINR(stats.todaySalesTotal)} tone="good" />
        <StatCard
          label="Pending customer payments"
          value={formatINR(stats.pendingTotal)}
          tone={stats.pendingTotal > 0 ? 'danger' : 'good'}
        />
        <StatCard label="Today's expenses" value={formatINR(stats.todayExpenseTotal)} />
      </div>

      <div className="mt-6">
        <h2 className="font-display font-semibold mb-3">Low stock products</h2>
        {lowStock.length === 0 ? (
          <EmptyState title="All products are above minimum stock" />
        ) : (
          <div className="bg-surface border border-line rounded-card divide-y divide-line">
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-ink/50">
                    Min: {formatNumber(p.min_stock_level)} KG
                  </p>
                </div>
                <Badge tone="danger">{formatNumber(p.current_stock)} KG left</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
