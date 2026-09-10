import { Routes, Route } from 'react-router-dom'
import RequireAuth from './components/RequireAuth.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Products from './pages/Products.jsx'
import StockConversion from './pages/StockConversion.jsx'
import Purchases from './pages/Purchases.jsx'
import Sales from './pages/Sales.jsx'
import Customers from './pages/Customers.jsx'
import CustomerDetail from './pages/CustomerDetail.jsx'
import Suppliers from './pages/Suppliers.jsx'
import SupplierDetail from './pages/SupplierDetail.jsx'
import Expenses from './pages/Expenses.jsx'
import StockAdjustments from './pages/StockAdjustments.jsx'
import Reports from './pages/Reports.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="conversion" element={<StockConversion />} />
        <Route path="purchases" element={<Purchases />} />
        <Route path="sales" element={<Sales />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="suppliers/:id" element={<SupplierDetail />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="adjustments" element={<StockAdjustments />} />
        <Route path="reports" element={<Reports />} />
      </Route>
    </Routes>
  )
}
