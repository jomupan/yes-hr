import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { LoginPage } from "./pages/LoginPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { DashboardPage } from "./pages/DashboardPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { AdminRoute } from "@/components/admin/AdminRoute";
import { AdminDashboard } from "@/pages/admin/AdminDashboard";
import { AdminLeaveRequests } from "@/pages/admin/AdminLeaveRequests";
import { AdminLeaveRecords } from "@/pages/admin/AdminLeaveRecords";
import { AdminLeaveCalendar } from "@/pages/admin/AdminLeaveCalendar";
import { AdminEmployees } from "@/pages/admin/AdminEmployees";
import { AdminAttendance } from "@/pages/admin/AdminAttendance";
import { AdminAttendanceEmployee } from "@/pages/admin/AdminAttendanceEmployee";
import { AdminReports } from "@/pages/admin/AdminReports";
import { AdminSettings } from "@/pages/admin/AdminSettings";
import { AdminNotifications } from "@/pages/admin/AdminNotifications";
import { AdminDepartments } from "@/pages/admin/AdminDepartments";
import { AdminCompanies } from "@/pages/admin/AdminCompanies";
import { AdminPayslips } from "@/pages/admin/AdminPayslips";
import { AdminAdmins } from "@/pages/admin/AdminAdmins";
import { AdminClaims } from "@/pages/admin/AdminClaims";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          {/* Shared login for staff & admin */}
          <Route path="/login" element={<LoginPage />} />
          {/* Password reset flows */}
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          {/* Staff portal home */}
          <Route path="/dashboard" element={<DashboardPage />} />
          {/* Staff notifications */}
          <Route path="/notifications" element={<NotificationsPage />} />
          {/* Admin portal */}
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/leave-requests"
            element={
              <AdminRoute>
                <AdminLeaveRequests />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/leave-records"
            element={
              <AdminRoute>
                <AdminLeaveRecords />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/leave-calendar"
            element={
              <AdminRoute>
                <AdminLeaveCalendar />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/employees"
            element={
              <AdminRoute>
                <AdminEmployees />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/attendance"
            element={
              <AdminRoute>
                <AdminAttendance />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/attendance/employee/:username"
            element={
              <AdminRoute>
                <AdminAttendanceEmployee />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <AdminRoute>
                <AdminReports />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/departments"
            element={
              <AdminRoute>
                <AdminDepartments />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/companies"
            element={
              <AdminRoute>
                <AdminCompanies />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/claims"
            element={
              <AdminRoute>
                <AdminClaims />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/payslips"
            element={
              <AdminRoute>
                <AdminPayslips />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/admins"
            element={
              <AdminRoute>
                <AdminAdmins />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <AdminRoute>
                <AdminSettings />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/notifications"
            element={
              <AdminRoute>
                <AdminNotifications />
              </AdminRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
