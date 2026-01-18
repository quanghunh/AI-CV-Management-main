import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./index.css";
import './i18n/config'

// Lấy client_id từ file JSON anh gửi
const clientId = "392471570421-4lb57egpqahi7v2ifvvdkptica5cmqo7.apps.googleusercontent.com";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <GoogleOAuthProvider clientId={clientId}>
    <App />
  </GoogleOAuthProvider>  
);