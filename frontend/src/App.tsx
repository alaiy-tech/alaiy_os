import type { ReactNode } from "react";
import { Route, Routes } from "react-router-dom";

import { flattenNavItems } from "@/config/navigation";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import DashboardLayout from "@/components/layout/DashboardLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardHome from "@/pages/DashboardHome";
import ComingSoonPage from "@/pages/ComingSoonPage";
import ItemListPage from "@/features/item/ItemListPage";
import ItemDetailPage from "@/features/item/ItemDetailPage";
import SalesOrderListPage from "@/features/sales-order/SalesOrderListPage";
import SalesOrderDetailPage from "@/features/sales-order/SalesOrderDetailPage";
import CustomerListPage from "@/features/customer/CustomerListPage";
import CustomerDetailPage from "@/features/customer/CustomerDetailPage";

/**
 * Paths with a real, fully-built screen. Everything else in navigationConfig
 * still gets a route (rendering ComingSoonPage) so the sidebar is entirely
 * clickable - see docs/adding-a-screen.md for how to move an item from one
 * list to the other.
 */
const BUILT_LIST_SCREENS: Record<string, ReactNode> = {
  products: <ItemListPage />,
  "sales-orders": <SalesOrderListPage />,
  customers: <CustomerListPage />,
};

export default function App() {
  const navItems = flattenNavItems();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        {navItems
          .filter((item) => item.path !== "")
          .map((item) => (
            <Route
              key={item.path}
              path={item.path}
              element={BUILT_LIST_SCREENS[item.path] ?? <ComingSoonPage title={item.label} doctype={item.doctype} />}
            />
          ))}
        <Route path="products/:id" element={<ItemDetailPage />} />
        <Route path="sales-orders/:id" element={<SalesOrderDetailPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
      </Route>
    </Routes>
  );
}
