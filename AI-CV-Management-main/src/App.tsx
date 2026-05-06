
import React, { Suspense } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import { MainLayout } from "@/components/layout/MainLayout";

import * as DashboardPageModule from "@/pages/DashboardPage";
import * as JobsPageModule from "@/pages/JobsPage";
import * as CandidatesPageModule from "@/pages/CandidatesPage";
import * as InterviewsPageModule from "@/pages/InterviewsPage";
import * as CVFilterPageModule from "@/pages/CV-filter-page";
import * as LoginPageModule from "@/pages/LoginPage";
import * as ReviewsPageModule from "@/pages/ReviewsPage";
import * as EmailManagementPageModule from "@/pages/EmailManagementPage";
import * as SettingsPageModule from "@/pages/SettingsPage";
import * as ProfileSettingsPageModule from "@/pages/ProfileSettingsPage";
import * as AIToolsPageModule from "@/pages/AI/AIToolsPage";
import * as RegisterPageModule from "@/pages/RegisterPage";
import * as UsersPageModule from "@/pages/User";
import * as PermissionsPageModule from "@/pages/PermissionsPage";

function resolveModuleComponent<M extends Record<string, any>>(mod: M, names: string[]) {
  if (!mod) return null;
  if (mod.default) return mod.default as React.ComponentType<any>;
  for (const n of names) {
    if (mod[n]) return mod[n] as React.ComponentType<any>;
  }
  const keys = Object.keys(mod);
  for (const k of keys) {
    const candidate = mod[k];
    if (typeof candidate === "function" || typeof candidate === "object") return candidate as React.ComponentType<any>;
  }
  return null;
}

const DashboardPage = resolveModuleComponent(DashboardPageModule, ["DashboardPage"]) ?? (() => <div>Missing Dashboard</div>);
const JobsPage = resolveModuleComponent(JobsPageModule, ["JobsPage"]) ?? (() => <div>Missing Jobs</div>);
const CandidatesPage = resolveModuleComponent(CandidatesPageModule, ["CandidatesPage"]) ?? (() => <div>Missing Candidates</div>);
const InterviewsPage = resolveModuleComponent(InterviewsPageModule, ["InterviewsPage"]) ?? (() => <div>Missing Interviews</div>);
const CVFilterPage = resolveModuleComponent(CVFilterPageModule, ["CVFilterPage", "CVFilter"]) ?? (() => <div>Missing CV Filter</div>);
const LoginPage = resolveModuleComponent(LoginPageModule, ["LoginPage"]) ?? (() => <div>Missing Login</div>);
const ReviewsPage = resolveModuleComponent(ReviewsPageModule, ["ReviewsPage"]) ?? (() => <div>Missing Reviews</div>);
const EmailManagementPage = resolveModuleComponent(EmailManagementPageModule, ["EmailManagementPage"]) ?? (() => <div>Missing Email Management</div>);
const SettingsPage = resolveModuleComponent(SettingsPageModule, ["SettingsPage"]) ?? (() => <div>Missing Settings</div>);
const ProfileSettingsPage = resolveModuleComponent(ProfileSettingsPageModule, ["ProfileSettingsPage"]) ?? (() => <div>Missing Profile Settings</div>);
const AIToolsPage = resolveModuleComponent(AIToolsPageModule, ["AIToolsPage"]) ?? (() => <div>Missing AI Tools</div>);
const RegisterPage = resolveModuleComponent(RegisterPageModule, ["RegisterPage"]) ?? (() => <div>Missing Register</div>);
const UsersPage = resolveModuleComponent(UsersPageModule, ["UsersPage","User"]) ?? (() => <div>Missing Users</div>);
const PermissionsPage = resolveModuleComponent(PermissionsPageModule, ["PermissionsPage"]) ?? (() => <div>Missing Permissions</div>);

const LoadingScreen = () => (
  <div className="flex items-center justify-center h-screen bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Đang tải...</p>
    </div>
  </div>
);

const router = createBrowserRouter([

  { 
    path: "/login", 
    element: <LoginPage /> 
  },
  { 
    path: "/register", 
    element: <RegisterPage /> 
  },
  

  {
    path: "/",
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [

      { 
        index: true, 
        element: <Navigate to="/dashboard" replace /> 
      },
      

      { 
        path: "dashboard", 
        element: (
          <ProtectedRoute requiredPermission={{ module: "dashboard", action: "view" }}>
            <DashboardPage />
          </ProtectedRoute>
        )
      },
      

      { 
        path: "cai-dat/thong-tin-ca-nhan", 
        element: (
          <ProtectedRoute>
            <ProfileSettingsPage />
          </ProtectedRoute>
        )
      },
      

      { 
        path: "cai-dat", 
        element: (
          <ProtectedRoute requiredPermission={{ module: "settings", action: "view" }}>
            <SettingsPage />
          </ProtectedRoute>
        )
      },
      

      

      { 
        path: "mo-ta-cong-viec", 
        element: (
          <ProtectedRoute requiredPermission={{ module: "jobs", action: "view" }}>
            <JobsPage />
          </ProtectedRoute>
        )
      },
      

      { 
        path: "ung-vien", 
        element: (
          <ProtectedRoute requiredPermission={{ module: "candidates", action: "view" }}>
            <CandidatesPage />
          </ProtectedRoute>
        )
      },
      

      { 
        path: "phong-van", 
        element: (
          <ProtectedRoute requiredPermission={{ module: "interviews", action: "view" }}>
            <InterviewsPage />
          </ProtectedRoute>
        )
      },
      

      { 
        path: "loc-cv", 
        element: (
          <ProtectedRoute requiredPermission={{ module: "cv_filter", action: "view" }}>
            <CVFilterPage />
          </ProtectedRoute>
        )
      },
      

      { 
        path: "danh-gia", 
        element: (
          <ProtectedRoute requiredPermission={{ module: "reviews", action: "view" }}>
            <ReviewsPage />
          </ProtectedRoute>
        )
      },
      

      

      { 
        path: "nguoi-dung", 
        element: (
          <ProtectedRoute requiredPermission={{ module: "users", action: "view" }}>
            <UsersPage />
          </ProtectedRoute>
        )
      },
      

      { 
        path: "quan-ly-email", 
        element: (
          <ProtectedRoute requiredPermission={{ module: "email", action: "view" }}>
            <EmailManagementPage />
          </ProtectedRoute>
        )
      },
      

      { 
        path: "phan-quyen", 
        element: (
          <ProtectedRoute requiredPermission={{ module: "permissions", action: "view" }}>
            <PermissionsPage />
          </ProtectedRoute>
        )
      },
      

      { 
        path: "ai", 
        element: (
          <ProtectedRoute requiredPermission={{ module: "ai_tools", action: "view" }}>
            <AIToolsPage />
          </ProtectedRoute>
        )
      },
    ],
  },
  

  { 
    path: "*", 
    element: <Navigate to="/login" replace /> 
  },
]);

export default function App() {
  return (
    <AuthProvider>
      <PermissionsProvider>
        <Suspense fallback={<LoadingScreen />}>
          <RouterProvider router={router} />
        </Suspense>
        <Toaster
          position="top-right"
          richColors
          closeButton
          duration={3500}
          toastOptions={{
            style: { fontFamily: 'inherit' },
          }}
        />
      </PermissionsProvider>
    </AuthProvider>
  );
}