"use client"

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  User, Briefcase, ClipboardList, RefreshCw, Database,
  Flame, TrendingUp, TrendingDown, Clock
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { fetchRecentActivities } from '@/lib/activityLogger';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { useTranslation } from 'react-i18next';

// ─── Types ───────────────────────────────────────────────────────────────────

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
  user_id?: string;
  action: string;
  details: string | null;
  entity_type: string | null;
  created_at: string;
  metadata?: Record<string, any>;
}

interface TopJobData {
  id: string;
  title: string;
  candidate_count: number;
  status: string;
}

interface RawCandidate {
  id: string;
  created_at: string;
  job_id: string | null;
  source: string | null;
}

type TrendPeriod = 'day' | 'month' | 'year';

// ─── isOpenJob ────────────────────────────────────────────────────────────────

const CLOSED_STATUSES = new Set([
  'bản nháp', 'đã đóng', 'draft', 'closed', 'archived', 'inactive',
]);

function isOpenJob(status: string): boolean {
  if (!status) return false;
  return !CLOSED_STATUSES.has(status.trim().toLowerCase());
}
function isClosedJob(status: string): boolean { return !isOpenJob(status); }

// ─── Pure-computation helpers ─────────────────────────────────────────────────

function buildTimeline(period: TrendPeriod): string[] {
  const now = new Date();
  const WINDOW = period === 'day' ? 30 : period === 'month' ? 12 : 5;
  const labels: string[] = [];
  for (let i = WINDOW - 1; i >= 0; i--) {
    const d = new Date(now);
    if (period === 'day') {
      d.setDate(d.getDate() - i);
      labels.push(`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`);
    } else if (period === 'month') {
      d.setMonth(d.getMonth() - i);
      labels.push(`${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`);
    } else {
      d.setFullYear(d.getFullYear() - i);
      labels.push(`${d.getFullYear()}`);
    }
  }
  return labels;
}

function dateToBucket(iso: string, period: TrendPeriod): string {
  const d = new Date(iso);
  if (period === 'day')
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  if (period === 'month')
    return `${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  return `${d.getFullYear()}`;
}

function cutoffDate(period: TrendPeriod): Date {
  const WINDOW = period === 'day' ? 30 : period === 'month' ? 12 : 5;
  const d = new Date();
  if (period === 'day') d.setDate(d.getDate() - WINDOW + 1);
  else if (period === 'month') d.setMonth(d.getMonth() - WINDOW + 1);
  else d.setFullYear(d.getFullYear() - WINDOW + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function computeTrend(candidates: RawCandidate[], period: TrendPeriod, jobId: string) {
  const timeline = buildTimeline(period);
  const cutoff = cutoffDate(period);
  const buckets: Record<string, number> = {};
  timeline.forEach(l => (buckets[l] = 0));
  candidates.forEach(c => {
    if (new Date(c.created_at) < cutoff) return;
    if (jobId !== 'all' && c.job_id !== jobId) return;
    const bucket = dateToBucket(c.created_at, period);
    if (bucket in buckets) buckets[bucket]++;
  });
  return timeline.map(label => ({ label, count: buckets[label] }));
}

function computeSources(candidates: RawCandidate[], jobId: string) {
  const filtered = jobId === 'all' ? candidates : candidates.filter(c => c.job_id === jobId);
  const buckets: Record<string, number> = {};
  filtered.forEach(c => {
    const src = c.source?.trim() || 'Khác';
    buckets[src] = (buckets[src] || 0) + 1;
  });
  return Object.entries(buckets)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

// ─── Activity helpers ─────────────────────────────────────────────────────────

/** Màu dot cho từng action */
function getActivityDotColor(action: string): string {
  const a = action.toLowerCase();
  if (a.includes('cv') || a.includes('ứng viên') || a.includes('nộp')) return 'bg-blue-500';
  if (a.includes('tạo') || a.includes('công việc') || a.includes('jd')) return 'bg-green-500';
  if (a.includes('phỏng vấn')) return 'bg-purple-500';
  if (a.includes('đánh giá')) return 'bg-orange-500';
  if (a.includes('cập nhật') || a.includes('sửa')) return 'bg-yellow-500';
  if (a.includes('email') || a.includes('gửi')) return 'bg-pink-500';
  if (a.includes('xóa')) return 'bg-red-500';
  if (a.includes('đăng nhập')) return 'bg-teal-500';
  if (a.includes('vai trò') || a.includes('phân quyền')) return 'bg-indigo-500';
  return 'bg-gray-400';
}

/** Badge màu cho entity_type */
function getEntityBadge(entityType: string | null): { label: string; className: string } | null {
  const map: Record<string, { label: string; className: string }> = {
    cv:         { label: 'CV', className: 'bg-blue-100 text-blue-700' },
    job:        { label: 'JD', className: 'bg-green-100 text-green-700' },
    interview:  { label: 'PV', className: 'bg-purple-100 text-purple-700' },
    user:       { label: 'User', className: 'bg-orange-100 text-orange-700' },
    email:      { label: 'Email', className: 'bg-pink-100 text-pink-700' },
    role:       { label: 'Role', className: 'bg-indigo-100 text-indigo-700' },
    permission: { label: 'Quyền', className: 'bg-gray-100 text-gray-700' },
    auth:       { label: 'Auth', className: 'bg-teal-100 text-teal-700' },
  };
  return entityType ? (map[entityType] || null) : null;
}

/** Format thời gian tương đối */
function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 30) return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

const PERIOD_LABELS: Record<TrendPeriod, string> = {
  day: '30 ngày gần nhất',
  month: '12 tháng gần nhất',
  year: '5 năm gần nhất',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { t } = useTranslation();

  const [allCandidates, setAllCandidates] = useState<RawCandidate[]>([]);
  const [topJobs, setTopJobs] = useState<TopJobData[]>([]);
  const [openJobs, setOpenJobs] = useState<TopJobData[]>([]);
  const [allJobsForChart, setAllJobsForChart] = useState<TopJobData[]>([]);
  // ✅ Dùng ActivityData mới có user_id, entity_type, metadata
  const [recentActivities, setRecentActivities] = useState<ActivityData[]>([]);
  const [stats, setStats] = useState<StatsData>({
    totalCV: 0, cvChange: 0, openJobs: 0, jobsChange: 0,
    interviewingCV: 0, interviewingChange: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string>('all');
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('month');

  // ── fetch ────────────────────────────────────────────────────────────────

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. All candidates
      const { data: cvRaw } = await supabase
        .from('cv_candidates')
        .select('id, created_at, job_id, source')
        .order('created_at', { ascending: true });
      const candidates: RawCandidate[] = (cvRaw as RawCandidate[]) ?? [];
      setAllCandidates(candidates);

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const thisMonthCount = candidates.filter(c => new Date(c.created_at) >= thisMonthStart).length;
      const lastMonthCount = candidates.filter(c => {
        const d = new Date(c.created_at);
        return d >= lastMonthStart && d < thisMonthStart;
      }).length;

      setStats(prev => ({
        ...prev,
        totalCV: candidates.length,
        cvChange: percentChange(thisMonthCount, lastMonthCount),
      }));

      // 2. Jobs
      const { data: jobsRaw } = await supabase
        .from('cv_jobs').select('id, title, status, created_at');
      const allJobs: any[] = jobsRaw ?? [];

      console.log('🔍 [Dashboard] Job statuses:', [...new Set(allJobs.map(j => j.status))]);

      const perJob: Record<string, number> = {};
      candidates.forEach(c => {
        if (c.job_id) perJob[c.job_id] = (perJob[c.job_id] || 0) + 1;
      });

      const toTopJob = (j: any): TopJobData => ({
        id: j.id, title: j.title, status: j.status,
        candidate_count: perJob[j.id] || 0,
      });
      const allJobsMapped = allJobs.map(toTopJob);

      const openList = allJobsMapped.filter(j => isOpenJob(j.status));
      setOpenJobs(openList);

      const jobsForChart = allJobsMapped
        .filter(j => isOpenJob(j.status) || j.candidate_count > 0)
        .sort((a, b) => {
          const aO = isOpenJob(a.status), bO = isOpenJob(b.status);
          if (aO && !bO) return -1; if (!aO && bO) return 1;
          return b.candidate_count - a.candidate_count;
        });
      setAllJobsForChart(jobsForChart);

      const sorted = [...allJobsMapped].sort((a, b) => b.candidate_count - a.candidate_count);
      setTopJobs(sorted.slice(0, 6));

      const openThisMonth = allJobs.filter(j =>
        isOpenJob(j.status) && new Date(j.created_at) >= thisMonthStart).length;
      const openLastMonth = allJobs.filter(j => {
        const d = new Date(j.created_at);
        return isOpenJob(j.status) && d >= lastMonthStart && d < thisMonthStart;
      }).length;

      setStats(prev => ({
        ...prev,
        openJobs: openList.length,
        jobsChange: percentChange(openThisMonth, openLastMonth),
      }));

      // 3. Interviews
      const { data: ivRaw } = await supabase
        .from('cv_interviews').select('id, interview_date, status');
      const ivAll: any[] = ivRaw ?? [];
      const activeStatuses = ['Đang chờ','Đang phỏng vấn','Đang đánh giá','Đang chờ đánh giá'];
      const activeCount = ivAll.filter(i => activeStatuses.includes(i.status)).length;
      const ivThisMonth = ivAll.filter(i => new Date(i.interview_date) >= thisMonthStart).length;
      const ivLastMonth = ivAll.filter(i => {
        const d = new Date(i.interview_date);
        return d >= lastMonthStart && d < thisMonthStart;
      }).length;
      setStats(prev => ({
        ...prev,
        interviewingCV: activeCount,
        interviewingChange: percentChange(ivThisMonth, ivLastMonth),
      }));

      // ✅ 4. Dùng fetchRecentActivities() từ activityLogger — trong 30 ngày
      const acts = await fetchRecentActivities(20);
      setRecentActivities(acts as ActivityData[]);

    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboardData(); }, []);

  // ── Derived ──────────────────────────────────────────────────────────────

  const trendData = useMemo(
    () => computeTrend(allCandidates, trendPeriod, selectedJobId),
    [allCandidates, trendPeriod, selectedJobId]
  );
  const sourceData = useMemo(
    () => computeSources(allCandidates, selectedJobId),
    [allCandidates, selectedJobId]
  );
  const hasTrendData = trendData.some(d => d.count > 0);
  const hasSourceData = sourceData.some(s => s.count > 0);
  const selectedJobTitle = selectedJobId === 'all'
    ? 'Tất cả vị trí'
    : allJobsForChart.find(j => j.id === selectedJobId)?.title ?? '';
  const selectedJobCandidateCount = selectedJobId === 'all'
    ? allCandidates.length
    : allJobsForChart.find(j => j.id === selectedJobId)?.candidate_count ?? 0;

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderChangeIndicator = (change: number) => {
    if (change > 0) return (
      <span className="text-green-600 flex items-center gap-1">
        <TrendingUp className="w-3 h-3" />+{change}%
      </span>
    );
    if (change < 0) return (
      <span className="text-red-600 flex items-center gap-1">
        <TrendingDown className="w-3 h-3" />{change}%
      </span>
    );
    return <span className="text-gray-500">0%</span>;
  };

  const TrendTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        <p className="text-sm text-gray-600">Số CV: <span className="font-bold text-blue-600">{payload[0].value}</span></p>
      </div>
    );
  };

  const SourceTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
        <p className="font-semibold">{payload[0].name}</p>
        <p className="text-sm text-gray-600">Số lượng: <span className="font-bold">{payload[0].value}</span></p>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6 bg-gray-50/50 min-h-screen lg:min-h-0">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold truncate">{t('dashboard.title')}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">{t('dashboard.systemOverview')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDashboardData} disabled={loading} className="flex-shrink-0">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{t('dashboard.refresh')}</span>
        </Button>
      </div>

      <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg p-4">
        {t('dashboard.realTimeData')}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        {[
          { label: t('dashboard.stats.totalCV'), value: stats.totalCV, change: stats.cvChange, icon: <User className="h-4 w-4 text-muted-foreground" /> },
          { label: t('dashboard.stats.openJobs'), value: stats.openJobs, change: stats.jobsChange, icon: <Briefcase className="h-4 w-4 text-muted-foreground" /> },
          { label: t('dashboard.stats.interviewingCV'), value: stats.interviewingCV, change: stats.interviewingChange, icon: <ClipboardList className="h-4 w-4 text-muted-foreground" /> },
        ].map(card => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
              {card.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {renderChangeIndicator(card.change)} {t('dashboard.stats.comparedToLastMonth')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ROW 1: Top vị trí + Hoạt động gần đây */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">

        {/* Top vị trí */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Flame className="w-5 h-5 text-orange-500" />
              {t('dashboard.charts.topJobs')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topJobs.length > 0 ? (
              <ul className="space-y-3">
                {topJobs.map((job, index) => (
                  <li key={job.id} className="flex items-center justify-between gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0 ${
                        index < 3 ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-md' : 'bg-gray-100 text-gray-600'
                      }`}>{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" title={job.title}>{job.title}</p>
                        <p className="text-xs text-muted-foreground">{job.candidate_count} {t('dashboard.topJobs.candidates')}</p>
                      </div>
                    </div>
                    <Badge
                      variant={index < 3 ? "destructive" : "secondary"}
                      className={index < 3 ? "bg-gradient-to-r from-orange-500 to-red-500 text-white border-0" : ""}
                    >
                      {index < 3 ? <span className="flex items-center gap-1"><Flame className="w-3 h-3" />{t('dashboard.topJobs.hot')}</span> : t('dashboard.topJobs.normal')}
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

        {/* ✅ Hoạt động gần đây — cải tiến */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg">{t('dashboard.charts.recentActivities')}</CardTitle>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                <span>30 ngày gần nhất</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            {recentActivities.length > 0 ? (
              <ul className="space-y-3">
                {recentActivities.map((activity) => {
                  const entityBadge = getEntityBadge(activity.entity_type);
                  const dotColor = getActivityDotColor(activity.action);
                  return (
                    <li key={activity.id} className="flex items-start gap-3 group">
                      {/* Avatar / dot */}
                      <div className="flex-shrink-0 mt-0.5">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className={`text-[10px] font-bold text-white ${dotColor}`}>
                            {activity.user_name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Header: user name + badge */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900 truncate">
                            {activity.user_name}
                          </span>
                          {entityBadge && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${entityBadge.className}`}>
                              {entityBadge.label}
                            </span>
                          )}
                        </div>

                        {/* Action */}
                        <p className="text-xs font-medium text-gray-700 mt-0.5">{activity.action}</p>

                        {/* Details */}
                        {activity.details && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate" title={activity.details}>
                            {activity.details}
                          </p>
                        )}

                        {/* Timestamp */}
                        <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span title={new Date(activity.created_at).toLocaleString('vi-VN')}>
                            {formatRelativeTime(activity.created_at)}
                          </span>
                          <span className="hidden group-hover:inline text-gray-300 ml-1">
                            • {new Date(activity.created_at).toLocaleString('vi-VN')}
                          </span>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <Database className="w-12 h-12 mb-2" />
                <p className="text-sm">{t('dashboard.noActivities')}</p>
                <p className="text-xs mt-1 text-gray-300">Chưa có hoạt động nào trong 30 ngày qua</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ROW 2: Vị trí đang tuyển */}
      <Card className="bg-white shadow-sm">
        <CardHeader className="p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Briefcase className="w-5 h-5 text-blue-500" />
                Vị trí đang tuyển
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-semibold text-blue-600">{openJobs.length} vị trí</span> đang mở •{' '}
                <span className="font-semibold text-gray-600">{allJobsForChart.length} vị trí</span> có dữ liệu
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                <SelectTrigger className="w-[220px] text-sm">
                  <SelectValue placeholder="Chọn vị trí..." />
                </SelectTrigger>
                <SelectContent className="bg-white z-50 shadow-lg border border-gray-200 max-h-[300px]">
                  <SelectItem value="all">Tất cả vị trí ({allCandidates.length} CV)</SelectItem>
                  {allJobsForChart.filter(j => isOpenJob(j.status)).length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Đang tuyển</div>
                      {allJobsForChart.filter(j => isOpenJob(j.status)).map(job => (
                        <SelectItem key={job.id} value={job.id}>{job.title} ({job.candidate_count} CV)</SelectItem>
                      ))}
                    </>
                  )}
                  {allJobsForChart.filter(j => isClosedJob(j.status) && j.candidate_count > 0).length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">Đã đóng / Bản nháp</div>
                      {allJobsForChart.filter(j => isClosedJob(j.status) && j.candidate_count > 0).map(job => (
                        <SelectItem key={job.id} value={job.id}>{job.title} ({job.candidate_count} CV)</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                {(['day','month','year'] as TrendPeriod[]).map(p => (
                  <button key={p} onClick={() => setTrendPeriod(p)}
                    className={`px-3 py-1.5 transition-colors ${trendPeriod === p ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    {{ day:'Ngày', month:'Tháng', year:'Năm' }[p]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selectedJobId !== 'all' && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">Đang xem:</span>
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border border-blue-200">{selectedJobTitle}</Badge>
              {(() => {
                const job = allJobsForChart.find(j => j.id === selectedJobId);
                if (!job) return null;
                const open = isOpenJob(job.status);
                return (
                  <Badge className={open ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}>
                    {open ? '🟢 Đang tuyển' : `⚫ ${job.status}`}
                  </Badge>
                );
              })()}
              <span className="text-xs text-gray-400">{selectedJobCandidateCount} CV</span>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-3 sm:p-6 pt-0">
          {allJobsForChart.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              <button onClick={() => setSelectedJobId('all')}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedJobId === 'all' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:text-blue-600'}`}
              >
                Tất cả
                <span className={`ml-1.5 font-semibold ${selectedJobId === 'all' ? 'text-blue-100' : 'text-gray-400'}`}>{allCandidates.length}</span>
              </button>
              {allJobsForChart.map(job => {
                const open = isOpenJob(job.status);
                const isSelected = selectedJobId === job.id;
                return (
                  <button key={job.id}
                    onClick={() => setSelectedJobId(prev => prev === job.id ? 'all' : job.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : open ? 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                    }`}
                    title={`${job.status}${open ? ' (đang tuyển)' : ''}`}
                  >
                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${open ? 'bg-green-400' : 'bg-gray-400'} ${isSelected ? 'opacity-70' : ''}`} />
                    {job.title}
                    <span className={`ml-1.5 font-semibold ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>{job.candidate_count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {allJobsForChart.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-8 mb-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <Briefcase className="w-10 h-10 text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Chưa có vị trí nào</p>
              <p className="text-xs text-gray-400 mt-1">Tạo JD và thêm ứng viên để xem thống kê</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Xu hướng CV theo thời gian</h3>
                <span className="text-xs text-gray-400">{PERIOD_LABELS[trendPeriod]}</span>
              </div>
              <div className="h-[260px]">
                {!hasTrendData ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Database className="w-12 h-12 mb-2" />
                    <p className="text-sm text-center">
                      {selectedJobId !== 'all' ? 'Vị trí này chưa có CV trong khoảng thời gian này' : 'Chưa có dữ liệu trong khoảng thời gian này'}
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top:5, right:10, left:-10, bottom:5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" tick={{ fill:'#6b7280' }} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} tick={{ fill:'#6b7280' }} />
                      <Tooltip content={<TrendTooltip />} />
                      <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2.5}
                        dot={{ r:3, fill:'#3b82f6', strokeWidth:0 }} activeDot={{ r:6 }} name="Số CV" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Nguồn ứng viên</h3>
              <div className="h-[260px]">
                {!hasSourceData ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Database className="w-12 h-12 mb-2" />
                    <p className="text-sm">{t('dashboard.noDataSources')}</p>
                    <p className="text-xs mt-1">{t('dashboard.addSourceColumn')}</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sourceData as any[]} dataKey="count" nameKey="source"
                        cx="50%" cy="45%" outerRadius={80} label={false} labelLine={false}
                      >
                        {sourceData.map((_, i) => (
                          <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<SourceTooltip />} />
                      <Legend verticalAlign="bottom" height={36}
                        formatter={(value: any, entry: any) => `${value} (${entry.payload.count})`}
                        wrapperStyle={{ fontSize:'11px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

export default DashboardPage;