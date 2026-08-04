import type { ReactNode } from "react";
import { Route, Routes } from "react-router-dom";

import { flattenNavItems, navigationConfig, settingsItem } from "@/config/navigation";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import DashboardLayout from "@/components/layout/DashboardLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardHome from "@/pages/DashboardHome";
import ComingSoonPage from "@/pages/ComingSoonPage";
import AskAlaiyPage from "@/pages/AskAlaiyPage";
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
  "ask-alaiy": <AskAlaiyPage />,
};

// path -> owning section label, for the Coming Soon screen's breadcrumb-ish subtitle.
const SECTION_BY_PATH = new Map(navigationConfig.flatMap((section) => section.items.map((item) => [item.path, section.label])));

export default function App() {
  const navItems = [...flattenNavItems(), settingsItem];

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
              element={
                BUILT_LIST_SCREENS[item.path] ?? (
                  <ComingSoonPage
                    title={item.label}
                    section={SECTION_BY_PATH.get(item.path) ?? "Alaiy OS"}
                    doctype={item.doctype}
                    icon={item.icon}
                    template={item.template}
                  />
                )
              }
            />
          ))}
        <Route path="products/:id" element={<ItemDetailPage />} />
        <Route path="sales-orders/:id" element={<SalesOrderDetailPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
      </Route>
    </Routes>
  );
}
