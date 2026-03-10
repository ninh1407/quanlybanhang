import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '../auth/RequireAuth'
import { RequireAdminRoute } from '../auth/RequireAdminRoute'
import { RequirePermissionRoute } from '../auth/RequirePermissionRoute'
import { RequireWarehouse } from '../auth/RequireWarehouse'
import { RequireLicense } from '../licensing/RequireLicense'
import { AdminLayout } from '../ui/AdminLayout'
import { CategoriesPage } from '../pages/CategoriesPage'
import { CustomersPage } from '../pages/CustomersPage'
import { DashboardPage } from '../pages/DashboardPage'
import { FinanceOverviewPage } from '../pages/FinanceOverviewPage'
import { FinanceCashflowPage } from '../pages/FinanceCashflowPage'
import { FinanceDebtsPage } from '../pages/FinanceDebtsPage'
import { HomePage } from '../pages/HomePage'
import { InventoryPage } from '../pages/InventoryPage'
import { LoginPage } from '../pages/LoginPage'
import { LicensePage } from '../pages/LicensePage'
import { SelectWarehousePage } from '../pages/SelectWarehousePage'
import { LocationsPage } from '../pages/LocationsPage'
import { MaterialsPage } from '../pages/MaterialsPage'
import { OrdersPage } from '../pages/OrdersPage'
import { ProductsPage } from '../pages/ProductsPage'
import { StaffPage } from '../pages/StaffPage'
import { SuppliersPage } from '../pages/SuppliersPage'
import { StockCountsPage } from '../pages/StockCountsPage'
import { StockVouchersPage } from '../pages/StockVouchersPage'
import { StockVoucherPrintPage } from '../pages/StockVoucherPrintPage'
import { AuditLogPage } from '../pages/AuditLogPage'
import { ApprovalCenterPage } from '../pages/ApprovalCenterPage'
import { TransferOrderPage } from '../pages/TransferOrderPage'
import { ReplenishmentPage } from '../pages/ReplenishmentPage'
import { WarehouseControlTowerPage } from '../pages/WarehouseControlTowerPage'
import { OrderMonitoringPage } from '../pages/OrderMonitoringPage'
import { InventoryRiskAnalysisPage } from '../pages/InventoryRiskAnalysisPage'
import { InventoryBalancingPage } from '../pages/InventoryBalancingPage'
import { SettingsPage } from '../pages/SettingsPage'
import { NotificationsPage } from '../pages/NotificationsPage'
import { WarehousePerformancePage } from '../pages/WarehousePerformancePage'
import { ChannelIntegrationPage } from '../pages/ChannelIntegrationPage'
import { PickingPackingPage } from '../pages/PickingPackingPage'
import { HelpPage } from '../pages/HelpPage'
import { OrderPrintPage } from '../pages/OrderPrintPage'

export function AppRoutes() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/license" element={<LicensePage />} />
        <Route
          element={
            <RequireLicense>
              <Outlet />
            </RequireLicense>
          }
        >
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <Outlet />
              </RequireAuth>
            }
          >
            <Route path="/select-warehouse" element={<SelectWarehousePage />} />
            <Route
              element={
                <RequireWarehouse>
                  <AdminLayout />
                </RequireWarehouse>
              }
            >
              <Route index element={<HomePage />} />
            <Route
              path="/dashboard"
              element={
                <RequirePermissionRoute permission="dashboard:read">
                  <DashboardPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/products"
              element={
                <RequirePermissionRoute permission="products:read">
                  <ProductsPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/categories"
              element={
                <RequirePermissionRoute permission="products:read">
                  <CategoriesPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/suppliers"
              element={
                <RequirePermissionRoute permission="products:read">
                  <SuppliersPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/orders/:id/print"
              element={
                <RequirePermissionRoute permission="orders:read">
                  <OrderPrintPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <RequirePermissionRoute permission="orders:read">
                  <OrdersPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <RequirePermissionRoute permission="inventory:read">
                  <InventoryPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/warehouse-control-tower"
              element={
                <RequirePermissionRoute permission="inventory:read">
                  <WarehouseControlTowerPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/order-monitoring"
              element={
                <RequirePermissionRoute permission="inventory:read">
                  <OrderMonitoringPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/transfers"
              element={
                <RequirePermissionRoute permission="inventory:read">
                  <TransferOrderPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/replenishment"
              element={
                <RequirePermissionRoute permission="inventory:read">
                  <ReplenishmentPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/inventory-balancing"
              element={
                <RequirePermissionRoute permission="inventory:read">
                  <InventoryBalancingPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/inventory-risk"
              element={
                <RequirePermissionRoute permission="inventory:read">
                  <InventoryRiskAnalysisPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/warehouse-performance"
              element={
                <RequirePermissionRoute permission="inventory:read">
                  <WarehousePerformancePage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/channel-integration"
              element={
                <RequirePermissionRoute permission="orders:write">
                  <ChannelIntegrationPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/pick-pack"
              element={
                <RequirePermissionRoute permission="inventory:read">
                  <PickingPackingPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/locations"
              element={
                <RequireAdminRoute>
                  <RequirePermissionRoute permission="inventory:read">
                    <LocationsPage />
                  </RequirePermissionRoute>
                </RequireAdminRoute>
              }
            />
            <Route
              path="/stock-vouchers"
              element={
                <RequirePermissionRoute permission="inventory:read">
                  <StockVouchersPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/stock-vouchers/:id/print"
              element={
                <RequirePermissionRoute permission="inventory:read">
                  <StockVoucherPrintPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/stock-counts"
              element={
                <RequirePermissionRoute permission="inventory:read">
                  <StockCountsPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/materials"
              element={
                <RequirePermissionRoute permission="inventory:read">
                  <MaterialsPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/finance"
              element={<Navigate to="/finance/overview" replace />}
            />
            <Route
              path="/finance/overview"
              element={
                <RequirePermissionRoute permission="finance:read">
                  <FinanceOverviewPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/finance/cashflow"
              element={
                <RequirePermissionRoute permission="finance:read">
                  <FinanceCashflowPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/finance/debts"
              element={
                <RequirePermissionRoute permission="finance:read">
                  <FinanceDebtsPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <RequirePermissionRoute permission="customers:read">
                  <CustomersPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/staff"
              element={
                <RequirePermissionRoute permission="staff:read">
                  <StaffPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/approval-center"
              element={
                <RequirePermissionRoute permission="inventory:read">
                  <ApprovalCenterPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/audit"
              element={
                <RequirePermissionRoute permission="staff:read">
                  <AuditLogPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <RequirePermissionRoute permission="staff:read">
                  <SettingsPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <RequirePermissionRoute permission="dashboard:read">
                  <NotificationsPage />
                </RequirePermissionRoute>
              }
            />
            <Route
              path="/help"
              element={
                <RequirePermissionRoute permission="dashboard:read">
                  <HelpPage />
                </RequirePermissionRoute>
              }
            />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  )
}
