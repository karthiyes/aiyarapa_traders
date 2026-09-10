export function Card({ children, className = '' }) {
  return (
    <div className={`bg-surface border border-line rounded-card p-4 ${className}`}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, tone = 'default', sub }) {
  const toneMap = {
    default: 'text-ink',
    warn: 'text-accent',
    danger: 'text-danger',
    good: 'text-success'
  }
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs text-ink/60 font-medium">{label}</span>
      <span className={`text-2xl font-display font-semibold tabular ${toneMap[tone]}`}>{value}</span>
      {sub && <span className="text-xs text-ink/50">{sub}</span>}
    </Card>
  )
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const variants = {
    primary: 'bg-primary text-white active:bg-primary-dark',
    accent: 'bg-accent text-white active:bg-accent-light',
    outline: 'border border-line bg-transparent text-ink active:bg-paper',
    danger: 'bg-danger/10 text-danger border border-danger/20 active:bg-danger/20',
    ghost: 'text-primary active:bg-primary/10'
  }
  return (
    <button
      className={`px-4 py-2.5 rounded-card font-medium text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Input({ label, className = '', ...props }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label && <span className="text-ink/70 font-medium">{label}</span>}
      <input
        className={`border border-line rounded-card px-3 py-2.5 bg-surface text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${className}`}
        {...props}
      />
    </label>
  )
}

export function Select({ label, children, className = '', ...props }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label && <span className="text-ink/70 font-medium">{label}</span>}
      <select
        className={`border border-line rounded-card px-3 py-2.5 bg-surface text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  )
}

export function Textarea({ label, className = '', ...props }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label && <span className="text-ink/70 font-medium">{label}</span>}
      <textarea
        className={`border border-line rounded-card px-3 py-2.5 bg-surface text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${className}`}
        {...props}
      />
    </label>
  )
}

export function Badge({ children, tone = 'default' }) {
  const toneMap = {
    default: 'bg-ink/5 text-ink/70',
    warn: 'bg-accent/10 text-accent',
    danger: 'bg-danger/10 text-danger',
    good: 'bg-success/10 text-success'
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${toneMap[tone]}`}>{children}</span>
}

export function EmptyState({ title, hint }) {
  return (
    <div className="text-center py-12 px-4">
      <p className="text-ink/60 font-medium">{title}</p>
      {hint && <p className="text-ink/40 text-sm mt-1">{hint}</p>}
    </div>
  )
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative bg-surface w-full sm:max-w-md sm:rounded-card rounded-t-2xl max-h-[90vh] overflow-y-auto p-5 safe-bottom">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="text-ink/50 text-xl leading-none px-2">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function PageHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-xl font-display font-semibold">{title}</h1>
      {action}
    </div>
  )
}
