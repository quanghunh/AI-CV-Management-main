// src/components/FloatingChatbot.tsx
import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Key, Eye, EyeOff, Check, AlertCircle, Sparkles } from 'lucide-react';

interface APIKeys {
  openrouter?: string;
}

export default function FloatingChatbot() {
  const [showChatbot, setShowChatbot] = useState(false);
  const [apiKeys, setApiKeys] = useState<APIKeys>(() => {
    const savedKey = localStorage.getItem("openrouter_api_key");
    return savedKey ? { openrouter: savedKey } : {};
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      {/* Floating Chatbot Button with Pulse Animation */}
      <button
        onClick={() => setShowChatbot(!showChatbot)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center z-40 group"
        aria-label="AI Assistant"
      >
        {/* Pulse rings animation */}
        <span className="absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75 animate-ping"></span>
        <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" style={{ animationDelay: '0.5s' }}></span>
        
        {/* Icon */}
        <span className="relative z-10">
          {showChatbot ? (
            <X className="w-7 h-7" />
          ) : (
            <MessageCircle className="w-7 h-7" />
          )}
        </span>
        
        {/* Online indicator with pulse */}
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 border-2 border-white"></span>
        </span>

        {/* Tooltip */}
        <span className="absolute bottom-full mb-2 right-0 px-3 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          AI Assistant
        </span>
      </button>

      {/* Chatbot Popup */}
      {showChatbot && (
        <ChatbotPopup 
          onClose={() => setShowChatbot(false)} 
          apiKeys={apiKeys}
          setApiKeys={setApiKeys}
          messagesEndRef={messagesEndRef}
          scrollToBottom={scrollToBottom}
        />
      )}
    </>
  );
}

interface ChatbotPopupProps {
  onClose: () => void;
  apiKeys: APIKeys;
  setApiKeys: (keys: APIKeys) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  scrollToBottom: () => void;
}

function ChatbotPopup({ onClose, apiKeys, setApiKeys, messagesEndRef, scrollToBottom }: ChatbotPopupProps) {
  const [messages, setMessages] = useState<{role: string; content: string}[]>([
    { role: "bot", content: "Xin chào! Tôi là AI Assistant của bạn 👋\n\nTôi có thể giúp bạn:\n• Tóm tắt CV tốt nhất\n• Liệt kê CV tiềm năng\n• Gửi email template\n• Phân tích dữ liệu tuyển dụng\n\nHãy cho tôi biết bạn cần gì!" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [tempKeys, setTempKeys] = useState<APIKeys>(apiKeys);
  const [showKeys, setShowKeys] = useState({ openrouter: false });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const hasApiKey = !!apiKeys.openrouter;

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSaveApiKey = () => {
    setSaveStatus("saving");
    setTimeout(() => {
      const newKeys: APIKeys = {};
      
      if (tempKeys.openrouter?.trim()) {
        newKeys.openrouter = tempKeys.openrouter.trim();
        localStorage.setItem("openrouter_api_key", tempKeys.openrouter.trim());
      } else {
        localStorage.removeItem("openrouter_api_key");
      }
      
      setApiKeys(newKeys);
      setSaveStatus("saved");
      
      setTimeout(() => {
        setShowApiModal(false);
        setSaveStatus("idle");
      }, 1500);
    }, 500);
  };

  const handleRemoveApiKey = () => {
    setApiKeys({});
    setTempKeys({});
    localStorage.removeItem("openrouter_api_key");
    setShowApiModal(false);
  };

  const getMaskedKey = (key: string) => {
    if (!key) return "";
    if (key.length <= 8) return "••••••••";
    return `${key.slice(0, 4)}${"•".repeat(key.length - 8)}${key.slice(-4)}`;
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!hasApiKey) {
      setShowApiModal(true);
      return;
    }

    const userMsg = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput("");
    setLoading(true);

    try {
      const prompt = `Bạn là AI Assistant hỗ trợ Admin quản lý tuyển dụng.

Lịch sử:
${messages.map(m => `${m.role === 'user' ? 'Admin' : 'AI'}: ${m.content}`).join('\n')}

Admin: ${currentInput}

Trả lời chuyên nghiệp, hữu ích bằng tiếng Việt:`;

      const botResponse = await callOpenRouterAPI(prompt, apiKeys.openrouter!);
      const botMsg = { role: "bot", content: botResponse };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      console.error('OpenRouter API error:', err);
      const errorMsg = { 
        role: "bot", 
        content: `⚠️ Lỗi: ${err.message}. Vui lòng kiểm tra API key.` 
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Chatbot Popup with slide-in animation */}
      <div className="fixed bottom-24 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden border border-gray-200 animate-slide-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm relative">
              <MessageCircle className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></span>
            </div>
            <div>
              <h3 className="font-semibold">AI Assistant</h3>
              <p className="text-xs opacity-90 flex items-center gap-1">
                {hasApiKey ? (
                  <>
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    Đang hoạt động
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                    Chưa cấu hình
                  </>
                )}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* API Key Warning */}
        {!hasApiKey && (
          <div className="p-3 bg-amber-50 border-b border-amber-200 flex items-start gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0 animate-bounce" />
            <div className="flex-1 text-xs">
              <p className="font-medium text-amber-800">Chưa cấu hình API Key</p>
              <button 
                onClick={() => setShowApiModal(true)}
                className="text-amber-700 underline mt-1 hover:text-amber-900"
              >
                Cấu hình ngay →
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.map((msg, i) => (
            <div 
              key={i} 
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in-up`}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                msg.role === "user" 
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-br-sm shadow-md" 
                  : msg.content.startsWith("⚠️")
                    ? "bg-red-50 text-red-800 border border-red-200 rounded-bl-sm"
                    : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm"
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-gray-500 text-sm animate-fade-in">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="text-xs">AI đang suy nghĩ...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        {hasApiKey && (
          <div className="px-4 py-2 bg-white border-t border-gray-200">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setInput("Tóm tắt 5 CV tốt nhất")}
                className="text-xs px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition hover:scale-105"
              >
                📄 CV tốt
              </button>
              <button
                onClick={() => setInput("Liệt kê CV tiềm năng")}
                className="text-xs px-2.5 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition hover:scale-105"
              >
                🎯 Tiềm năng
              </button>
              <button
                onClick={() => setInput("Gửi email template")}
                className="text-xs px-2.5 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition hover:scale-105"
              >
                ✉️ Email
              </button>
              <button
                onClick={() => setInput("Thống kê tuyển dụng")}
                className="text-xs px-2.5 py-1.5 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition hover:scale-105"
              >
                📊 Thống kê
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 bg-white border-t border-gray-200">
          <div className="flex gap-2">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !loading && handleSend()}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" 
              placeholder={hasApiKey ? "Hỏi AI..." : "Cấu hình API key để chat"}
              disabled={loading || !hasApiKey}
            />
            <button 
              onClick={handleSend}
              disabled={loading || !input.trim() || !hasApiKey}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-2 rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition hover:scale-105"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* API Key Modal */}
      {showApiModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] animate-fade-in">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md animate-scale-in">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Key className="w-5 h-5" />
              Cấu hình OpenRouter API Key
            </h2>

            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <label className="block text-sm font-medium text-gray-700">
                    OpenRouter API Key
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showKeys.openrouter ? "text" : "password"}
                    value={tempKeys.openrouter || ""}
                    onChange={(e) => setTempKeys(prev => ({ ...prev, openrouter: e.target.value }))}
                    placeholder="sk-or-v1-..."
                    className="w-full border rounded-md px-3 py-2 pr-10 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <button
                    onClick={() => setShowKeys(prev => ({ ...prev, openrouter: !prev.openrouter }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showKeys.openrouter ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Lấy từ{" "}
                  <a 
                    href="https://openrouter.ai/keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-purple-600 underline hover:text-purple-800"
                  >
                    OpenRouter Dashboard
                  </a>
                </p>
                {apiKeys.openrouter && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                    ✓ Key hiện tại: {getMaskedKey(apiKeys.openrouter)}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSaveApiKey}
                  disabled={saveStatus === "saving"}
                  className={`flex-1 px-4 py-2 rounded-md font-medium transition ${
                    saveStatus === "saved"
                      ? "bg-green-600 text-white"
                      : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
                  }`}
                >
                  {saveStatus === "saving" ? (
                    "Đang lưu..."
                  ) : saveStatus === "saved" ? (
                    <span className="flex items-center justify-center gap-1">
                      <Check className="w-4 h-4" />
                      Đã lưu
                    </span>
                  ) : (
                    "Lưu API Key"
                  )}
                </button>
                
                {apiKeys.openrouter && (
                  <button
                    onClick={handleRemoveApiKey}
                    className="px-4 py-2 rounded-md bg-red-100 text-red-700 hover:bg-red-200"
                  >
                    Xóa
                  </button>
                )}
                
                <button
                  onClick={() => {
                    setShowApiModal(false);
                    setTempKeys(apiKeys);
                    setSaveStatus("idle");
                  }}
                  className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Hủy
                </button>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-md">
              <p className="text-xs text-blue-800">
                <strong>💡 Lưu ý:</strong> OpenRouter hỗ trợ nhiều AI models (GPT-4, Claude, Gemini...). 
                API key sẽ được lưu cục bộ trên trình duyệt của bạn.
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.4s ease-out;
        }

        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
      `}</style>
    </>
  );
}

async function callOpenRouterAPI(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'CV Recruitment System'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'Bạn là AI Assistant chuyên nghiệp hỗ trợ tuyển dụng. Trả lời chính xác, ngắn gọn bằng tiếng Việt.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  throw new Error('Invalid OpenRouter response format');
}