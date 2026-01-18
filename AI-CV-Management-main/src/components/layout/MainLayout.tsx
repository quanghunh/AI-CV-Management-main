// src/components/layout/MainLayout.tsx
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import FloatingChatbot from "@/components/FloatingChatbot";

export function MainLayout() {
  return (
    <div className="flex relative">
      <Sidebar />
      <main className="flex-1 ml-64 relative z-0">
        <Outlet />
      </main>
      
      {/* Floating Chatbot - Sẽ xuất hiện ở tất cả các trang */}
      <FloatingChatbot />
    </div>
  );
}