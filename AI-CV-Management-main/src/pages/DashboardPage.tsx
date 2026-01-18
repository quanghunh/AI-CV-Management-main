"use client"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Briefcase, ClipboardList, RefreshCw, Database, Flame, MessageCircle, X, Send, Sparkles, Key, Eye, EyeOff, Check, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useTranslation } from 'react-i18next';

interface APIKeys {
  openrouter?: string;
}

interface SourceData {
  source: string;
  count: number;
}

interface TrendData {
  month: string;
  count: number;
}

interface StatsData {
  totalCV: number;
  cvChange: number;
  openJobs: number;
  jobsChange: number;
  interviewingCV: number;
  interviewingChange: number;
}

interface ActivityData {
  id: string;
  user_name: string;
  action: string;
  details: string | null;
  created_at: string;
}

interface TopJobData {
  id: string;
  title: string;
  candidate_count: number;
  status: string;
}

export function DashboardPage() {
  const { t } = useTranslation();
  const [showChatbot, setShowChatbot] = useState(false);
  const [apiKeys, setApiKeys] = useState<APIKeys>(() => {
    const savedKey = localStorage.getItem("openrouter_api_key");
    return savedKey ? { openrouter: savedKey } : {};
  });

  const [stats, setStats] = useState<StatsData>({ 
    totalCV: 0,
    cvChange: 0,
    openJobs: 0,
    jobsChange: 0,
    interviewingCV: 0,
    interviewingChange: 0 
  });
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [sourceData, setSourceData] = useState<SourceData[]>([]);
  const [topJobs, setTopJobs] = useState<TopJobData[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick fix: Add error handling to fetchDashboardData
// Replace the fetchDashboardData function in DashboardPage.tsx

const fetchDashboardData = async () => {
  setLoading(true);
  try {
    // ⚠️ SAFE MODE: Wrap all RPC calls in try-catch
    
    // Lấy thống kê CV
    try {
      const { data: cvStats, error: cvError } = await supabase.rpc('get_cv_growth_stats');
      if (!cvError && cvStats?.[0]) {
        const cvData = cvStats[0];
        setStats(prev => ({ 
          ...prev,
          totalCV: Number(cvData.total_cv) || 0,
          cvChange: Number(cvData.percentage_change) || 0
        }));
      }
    } catch (err) {
      console.warn("⚠️ RPC get_cv_growth_stats not available, using fallback");
      // Fallback: Count from cv_candidates table
      const { count } = await supabase.from('cv_candidates').select('*', { count: 'exact', head: true });
      setStats(prev => ({ ...prev, totalCV: count || 0 }));
    }
    
    // Lấy thống kê công việc
    try {
      const { data: jobsStats, error: jobsError } = await supabase.rpc('get_jobs_growth_stats');
      if (!jobsError && jobsStats?.[0]) {
        const jobsData = jobsStats[0];
        setStats(prev => ({ 
          ...prev,
          openJobs: Number(jobsData.total_open_jobs) || 0,
          jobsChange: Number(jobsData.percentage_change) || 0
        }));
      }
    } catch (err) {
      console.warn("⚠️ RPC get_jobs_growth_stats not available, using fallback");
      const { count } = await supabase.from('cv_jobs').select('*', { count: 'exact', head: true }).eq('status', 'open');
      setStats(prev => ({ ...prev, openJobs: count || 0 }));
    }
    
    // Lấy thống kê phỏng vấn
    try {
      const { data: interviewStats, error: interviewError } = await supabase.rpc('get_interview_stats');
      if (!interviewError && interviewStats?.[0]) {
        const interviewData = interviewStats[0];
        setStats(prev => ({ 
          ...prev,
          interviewingCV: Number(interviewData.total_interviews) || 0,
          interviewingChange: Number(interviewData.percentage_change) || 0
        }));
      }
    } catch (err) {
      console.warn("⚠️ RPC get_interview_stats not available, using fallback");
      const { count } = await supabase.from('cv_interviews').select('*', { count: 'exact', head: true });
      setStats(prev => ({ ...prev, interviewingCV: count || 0 }));
    }

    // Xu hướng CV theo tháng
    try {
      const { data: trend, error: trendError } = await supabase.rpc('get_monthly_cv_trend');
      if (!trendError && trend) {
        setTrendData(trend as TrendData[]);
      }
    } catch (err) {
      console.warn("⚠️ RPC get_monthly_cv_trend not available");
      setTrendData([]);
    }

    // Nguồn ứng viên
    try {
      const { data: sources, error: sourcesError } = await supabase.rpc('get_candidate_sources');
      if (!sourcesError && sources && sources.length > 0) {
        setSourceData(sources as SourceData[]);
      } else {
        throw new Error('No sources data');
      }
    } catch (err) {
      console.warn("⚠️ RPC get_candidate_sources not available, using default");
      setSourceData([
        { source: 'Website', count: 0 },
        { source: 'LinkedIn', count: 0 },
        { source: 'Facebook', count: 0 }
      ]);
    }

    // Top vị trí tuyển dụng - THIS WORKS
    const { data: jobs, error: jobsError2 } = await supabase
      .from('cv_jobs')
      .select(`
        id,
        title,
        status,
        cv_candidates(count)
      `);
    
    if (!jobsError2 && jobs) {
      const jobsWithCount = jobs.map(job => ({
        id: job.id,
        title: job.title,
        status: job.status,
        candidate_count: job.cv_candidates?.[0]?.count || 0
      }));

      const sortedJobs = jobsWithCount.sort((a, b) => b.candidate_count - a.candidate_count);
      setTopJobs(sortedJobs.slice(0, 6));
    }

    // Hoạt động gần đây - THIS WORKS
    const { data: activities, error: activitiesError } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(6);
    
    if (!activitiesError && activities) {
      setRecentActivities(activities as ActivityData[]);
    }
    
  } catch (error) {
    console.error("❌ Dashboard data fetch error:", error);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

  const getActivityColor = (action: string) => {
    if (action.includes('Nộp CV') || action.includes('CV')) return 'bg-blue-500';
    if (action.includes('Tạo') || action.includes('công việc')) return 'bg-green-500';
    if (action.includes('Phỏng vấn') || action.includes('phỏng vấn')) return 'bg-purple-500';
    if (action.includes('Đánh giá')) return 'bg-orange-500';
    if (action.includes('Cập nhật')) return 'bg-yellow-500';
    if (action.includes('Email') || action.includes('email')) return 'bg-pink-500';
    return 'bg-gray-500';
  };

  const renderChangeIndicator = (change: number) => {
    if (change > 0) {
      return (
        <span className="text-green-600 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          +{change}%
        </span>
      );
    } else if (change < 0) {
      return (
        <span className="text-red-600 flex items-center gap-1">
          <TrendingDown className="w-3 h-3" />
          {change}%
        </span>
      );
    } else {
      return <span className="text-gray-500">0%</span>;
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
          <p className="font-semibold">{data.name}</p>
          <p className="text-sm text-gray-600">
            {t('common.quantity')}: <span className="font-bold">{data.value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50/50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('dashboard.systemOverview')}</p>
        </div>

        <Button variant="outline" onClick={fetchDashboardData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {t('dashboard.refresh')}
        </Button>
      </div>

      <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg p-4">
        {t('dashboard.realTimeData')}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.stats.totalCV')}</CardTitle>
            <User className="h-4 w-4 text-muted-foreground"/>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCV}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {renderChangeIndicator(stats.cvChange)} {t('dashboard.stats.comparedToLastMonth')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.stats.openJobs')}</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground"/>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.openJobs}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {renderChangeIndicator(stats.jobsChange)} {t('dashboard.stats.comparedToLastMonth')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.stats.interviewingCV')}</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground"/>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.interviewingCV}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {renderChangeIndicator(stats.interviewingChange)} {t('dashboard.stats.comparedToLastMonth')}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white shadow-sm">
          <CardHeader><CardTitle>{t('dashboard.charts.cvTrend')}</CardTitle></CardHeader>
          <CardContent className="h-[350px] p-4">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData as any[]} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '0.5rem' }} />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} activeDot={{ r: 8 }} name={t('dashboard.charts.cvCount')} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Database className="w-16 h-16 mb-2" />
                <p>{t('dashboard.noData')}</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="bg-white shadow-sm">
          <CardHeader><CardTitle>{t('dashboard.charts.candidateSources')}</CardTitle></CardHeader>
          <CardContent className="h-[350px]">
            {sourceData.length > 0 && sourceData.some(item => item.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={sourceData as any[]} 
                    dataKey="count" 
                    nameKey="source" 
                    cx="50%" 
                    cy="50%" 
                    outerRadius={100} 
                    fill="#8884d8" 
                    label={(entry: any) => {
                      const total = sourceData.reduce((sum, item) => sum + item.count, 0);
                      const percent = total > 0 ? (entry.count / total * 100).toFixed(0) : '0';
                      return `${entry.source}: ${percent}%`;
                    }}
                    labelLine={true}
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value: any, entry: any) => `${value} (${entry.payload.count})`}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Database className="w-16 h-16 mb-2" />
                <p>{t('dashboard.noDataSources')}</p>
                <p className="text-xs mt-2">{t('dashboard.addSourceColumn')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              {t('dashboard.charts.topJobs')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topJobs.length > 0 ? (
              <ul className="space-y-3">
                {topJobs.map((job, index) => (
                  <li 
                    key={job.id} 
                    className="flex items-center justify-between gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span 
                        className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0 ${
                          index < 3 
                            ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-md' 
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" title={job.title}>
                          {job.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {job.candidate_count} {t('dashboard.topJobs.candidates')}
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant={index < 3 ? "destructive" : "secondary"}
                      className={index < 3 ? "bg-gradient-to-r from-orange-500 to-red-500 text-white border-0" : ""}
                    >
                      {index < 3 ? (
                        <span className="flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          {t('dashboard.topJobs.hot')}
                        </span>
                      ) : (
                        t('dashboard.topJobs.normal')
                      )}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <Database className="w-12 h-12 mb-2" />
                <p className="text-sm">{t('dashboard.noJobsData')}</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="bg-white shadow-sm">
          <CardHeader><CardTitle>{t('dashboard.charts.recentActivities')}</CardTitle></CardHeader>
          <CardContent>
            {recentActivities.length > 0 ? (
              <ul className="space-y-4">
                {recentActivities.map((activity) => (
                  <li key={activity.id} className="flex items-start gap-3">
                    <span className={`block w-2.5 h-2.5 mt-1.5 rounded-full flex-shrink-0 ${getActivityColor(activity.action)}`}></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.user_name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {activity.action}
                        {activity.details && (
                          <span className="text-gray-500"> • {activity.details}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(activity.created_at).toLocaleString('vi-VN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <Database className="w-12 h-12 mb-2" />
                <p className="text-sm">{t('dashboard.noActivities')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Floating Chatbot Button */}
      <button
        onClick={() => setShowChatbot(!showChatbot)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center z-40"
        aria-label="AI Assistant"
      >
        {showChatbot ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
      </button>

      {/* Chatbot Popup */}
      {showChatbot && (
        <ChatbotPopup 
          onClose={() => setShowChatbot(false)} 
          apiKeys={apiKeys}
          setApiKeys={setApiKeys}
        />
      )}
    </div>
  );
}

interface ChatbotPopupProps {
  onClose: () => void;
  apiKeys: APIKeys;
  setApiKeys: (keys: APIKeys) => void;
}

function ChatbotPopup({ onClose, apiKeys, setApiKeys }: ChatbotPopupProps) {
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
      <div className="fixed bottom-24 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">AI Assistant</h3>
              <p className="text-xs opacity-90">
                {hasApiKey ? "Đang hoạt động" : "Chưa cấu hình"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* API Key Warning */}
        {!hasApiKey && (
          <div className="p-3 bg-amber-50 border-b border-amber-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-xs">
              <p className="font-medium text-amber-800">Chưa cấu hình API Key</p>
              <button 
                onClick={() => setShowApiModal(true)}
                className="text-amber-700 underline mt-1"
              >
                Cấu hình ngay
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                msg.role === "user" 
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-br-sm" 
                  : msg.content.startsWith("⚠️")
                    ? "bg-red-50 text-red-800 border border-red-200 rounded-bl-sm"
                    : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm"
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="text-xs">AI đang suy nghĩ...</span>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        {hasApiKey && (
          <div className="px-4 py-2 bg-white border-t border-gray-200">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setInput("Tóm tắt 5 CV tốt nhất")}
                className="text-xs px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition"
              >
                📄 CV tốt
              </button>
              <button
                onClick={() => setInput("Liệt kê CV tiềm năng")}
                className="text-xs px-2.5 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition"
              >
                🎯 Tiềm năng
              </button>
              <button
                onClick={() => setInput("Gửi email template")}
                className="text-xs px-2.5 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition"
              >
                ✉️ Email
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
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
              placeholder={hasApiKey ? "Hỏi AI..." : "Cấu hình API key để chat"}
              disabled={loading || !hasApiKey}
            />
            <button 
              onClick={handleSend}
              disabled={loading || !input.trim() || !hasApiKey}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-2 rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* API Key Modal */}
      {showApiModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
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
                    className="text-purple-600 underline"
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

export default DashboardPage;