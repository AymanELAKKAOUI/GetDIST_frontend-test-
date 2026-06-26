import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';

import { ToastProvider } from './components/ui/Toast';

import { ProtectedRoute } from './components/ProtectedRoute';

import { PermissionRoute } from './components/PermissionRoute';

import { AppLayout } from './components/Layout/AppLayout';

import { LoginPage } from './pages/LoginPage';

import { HomePage } from './pages/HomePage';

import { ProfilePage } from './pages/ProfilePage';

import { RolesPage } from './components/roles/RolesPage';

import { UsersPage } from './components/users/UsersPage';

import { SuppliersPage } from './components/suppliers/SuppliersPage';

import { PurchaseOrdersPage } from './components/purchaseOrders/PurchaseOrdersPage';

import { PurchaseOrderDetailPage } from './components/purchaseOrders/PurchaseOrderDetailPage';

import { DeliveryNotesPage } from './components/deliveryNotes/DeliveryNotesPage';

import { DeliveryNoteReviewPage } from './components/deliveryNotes/DeliveryNoteReviewPage';

import { InvoicesPage } from './components/invoices/InvoicesPage';

import { InvoiceReviewPage } from './components/invoices/InvoiceReviewPage';

import { PaymentsPage } from './components/payments/PaymentsPage';

import { CreatePaymentPage } from './components/payments/CreatePaymentPage';

import { PaymentDetailPage } from './components/payments/PaymentDetailPage';

import { ChecksPage } from './components/checks/ChecksPage';

import { CheckCalendarPage } from './components/checks/CheckCalendarPage';

import './App.css';



export default function App() {

  return (

    <BrowserRouter>

      <AuthProvider>

        <ToastProvider>

          <Routes>

            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>

              <Route element={<AppLayout />}>

                <Route path="/" element={<HomePage />} />

                <Route path="/profile" element={<ProfilePage />} />

                <Route element={<PermissionRoute requiredPermissions="rbac.manage" />}>

                  <Route path="/roles" element={<RolesPage />} />

                  <Route path="/users" element={<UsersPage />} />

                </Route>

                <Route

                  element={

                    <PermissionRoute

                      requiredPermissions={['supplier.view', 'supplier.manage']}

                    />

                  }

                >

                  <Route path="/suppliers" element={<SuppliersPage />} />

                </Route>

                <Route

                  element={

                    <PermissionRoute

                      requiredPermissions={['purchase_order.view', 'purchase_order.manage', 'purchase_order.respond']}

                    />

                  }

                >

                  <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />

                  <Route path="/purchase-orders/:id" element={<PurchaseOrderDetailPage />} />

                </Route>

                <Route element={<PermissionRoute requiredPermissions="delivery_note.view" />}>

                  <Route path="/delivery-notes" element={<DeliveryNotesPage />} />

                </Route>

                <Route element={<PermissionRoute requiredPermissions="delivery_note.respond" />}>

                  <Route path="/delivery-notes/:id" element={<DeliveryNoteReviewPage />} />

                </Route>

                <Route element={<PermissionRoute requiredPermissions="invoice.view" />}>

                  <Route path="/invoices" element={<InvoicesPage />} />

                </Route>

                <Route element={<PermissionRoute requiredPermissions="invoice.respond" />}>

                  <Route path="/invoices/:id" element={<InvoiceReviewPage />} />

                </Route>

                <Route element={<PermissionRoute requiredPermissions="payment.view" />}>

                  <Route path="/payments" element={<PaymentsPage />} />

                  <Route path="/payments/:id" element={<PaymentDetailPage />} />

                </Route>

                <Route element={<PermissionRoute requiredPermissions="payment.create" />}>

                  <Route path="/payments/new" element={<CreatePaymentPage />} />

                </Route>

                <Route element={<PermissionRoute requiredPermissions={['check.view', 'check.create']} />}>

                  <Route path="/checks" element={<ChecksPage />} />

                  <Route path="/checks/calendar" element={<CheckCalendarPage />} />

                </Route>

              </Route>

            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>

        </ToastProvider>

      </AuthProvider>

    </BrowserRouter>

  );

}


