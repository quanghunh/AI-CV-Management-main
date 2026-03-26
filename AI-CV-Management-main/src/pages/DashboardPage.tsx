"use client"

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  User, Briefcase, ClipboardList, RefreshCw, Database,
  Flame, TrendingUp, TrendingDown
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
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

/** Only the columns we actually need from cv_candidates */
interface RawCandidate {
  id: string;
  created_at: string;
  job_id: string | null;
  source: string | null;
}

type TrendPeriod = 'day' | 'month' | 'year';

// ─── Pure-computation helpers ─────────────────────────────────────────────────

/**
 * Build a complete, continuous timeline of bucket labels.
 * day  → last 30 days  e.g. "01/03"
 * month → last 12 months e.g. "03/2025"
 * year  → last 5 years  e.g. "2021"
 */
function buildTimeline(period: TrendPeriod): string[] {
  const now = new Date();
  const WINDOW = period === 'day' ? 30 : period === 'month' ? 12 : 5;
  const labels: string[] = [];

  for (let i = WINDOW - 1; i >= 0; i--) {
    const d = new Date(now);
    if (period === 'day') {
      d.setDate(d.getDate() - i);
      labels.push(
        `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
      );
    } else if (period === 'month') {
      d.setMonth(d.getMonth() - i);
      labels.push(
        `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
      );
    } else {
      d.setFullYear(d.getFullYear() - i);
      labels.push(`${d.getFullYear()}`);
    }
  }
  return labels;
}

/** Map a ISO date string → bucket label (must match buildTimeline format) */
function dateToBucket(iso: string, period: TrendPeriod): string {
  const d = new Date(iso);
  if (period === 'day') {
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  } else if (period === 'month') {
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } else {
    return `${d.getFullYear()}`;
  }
}

/** Earliest date we care about for the current window */
function cutoffDate(period: TrendPeriod): Date {
  const WINDOW = period === 'day' ? 30 : period === 'month' ? 12 : 5;
  const d = new Date();
  if (period === 'day') d.setDate(d.getDate() - WINDOW + 1);
  else if (period === 'month') d.setMonth(d.getMonth() - WINDOW + 1);
  else d.setFullYear(d.getFullYear() - WINDOW + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Aggregate candidates into [{label, count}] for Recharts.
 * Filters by jobId ('all' = no filter) and the current period window.
 */
function computeTrend(
  candidates: RawCandidate[],
  period: TrendPeriod,
  jobId: string
): { label: string; count: number }[] {
  const timeline = buildTimeline(period);
  const cutoff = cutoffDate(period);

  // initialise all buckets to 0
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

/** Aggregate candidates → source distribution */
function computeSources(
  candidates: RawCandidate[],
  jobId: string
): { source: string; count: number }[] {
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

/** Month-on-month percentage change */
function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
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

  // ── master data (fetched once, re-used everywhere) ──────────────────────
  const [allCandidates, setAllCandidates] = useState<RawCandidate[]>([]);
  const [topJobs, setTopJobs] = useState<TopJobData[]>([]);
  const [openJobs, setOpenJobs] = useState<TopJobData[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityData[]>([]);
  const [stats, setStats] = useState<StatsData>({
    totalCV: 0, cvChange: 0,
    openJobs: 0, jobsChange: 0,
    interviewingCV: 0, interviewingChange: 0,
  });
  const [loading, setLoading] = useState(true);

  // ── chart controls ──────────────────────────────────────────────────────
  const [selectedJobId, setSelectedJobId] = useState<string>('all');
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('month');

  // ── fetch ────────────────────────────────────────────────────────────────

  const fetchDashboardData = async () => {
    setLoading(true);
    try {

      // ── 1. All candidates (lightweight columns only) ──
      const { data: cvRaw, error: cvErr } = await supabase
        .from('cv_candidates')
        .select('id, created_at, job_id, source')
        .order('created_at', { ascending: true });

      if (cvErr) console.error('cv_candidates:', cvErr);
      const candidates: RawCandidate[] = (cvRaw as RawCandidate[]) ?? [];
      setAllCandidates(candidates);

      // ── 2. CV stats (total + month-on-month) ──
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

      // ── 3. Jobs ──
      const { data: jobsRaw, error: jobsErr } = await supabase
        .from('cv_jobs')
        .select('id, title, status, created_at');

      if (jobsErr) console.error('cv_jobs:', jobsErr);
      const allJobs: any[] = jobsRaw ?? [];

      // candidate count per job (computed from our already-loaded candidates)
      const perJob: Record<string, number> = {};
      candidates.forEach(c => {
        if (c.job_id) perJob[c.job_id] = (perJob[c.job_id] || 0) + 1;
      });

      const toTopJob = (j: any): TopJobData => ({
        id: j.id,
        title: j.title,
        status: j.status,
        candidate_count: perJob[j.id] || 0,
      });

      // open = status 'Đã đăng' (JobsPage uses this value)
      const openList = allJobs
        .filter(j => j.status === 'Đã đăng' || j.status === 'open')
        .map(toTopJob);
      setOpenJobs(openList);

      // top 6 by candidate count (across all jobs)
      const sorted = allJobs.map(toTopJob).sort((a, b) => b.candidate_count - a.candidate_count);
      setTopJobs(sorted.slice(0, 6));

      // open jobs month-on-month
      const openThisMonth = allJobs.filter(j =>
        (j.status === 'Đã đăng' || j.status === 'open') &&
        new Date(j.created_at) >= thisMonthStart
      ).length;
      const openLastMonth = allJobs.filter(j => {
        const d = new Date(j.created_at);
        return (j.status === 'Đã đăng' || j.status === 'open') &&
          d >= lastMonthStart && d < thisMonthStart;
      }).length;

      setStats(prev => ({
        ...prev,
        openJobs: openList.length,
        jobsChange: percentChange(openThisMonth, openLastMonth),
      }));

      // ── 4. Active interviews ──
      const { data: ivRaw, error: ivErr } = await supabase
        .from('cv_interviews')
        .select('id, interview_date, status');

      if (ivErr) console.error('cv_interviews:', ivErr);
      const ivAll: any[] = ivRaw ?? [];

      // "active" = not finished / not cancelled
      const activeStatuses = ['Đang chờ', 'Đang phỏng vấn', 'Đang đánh giá', 'Đang chờ đánh giá'];
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

      // ── 5. Recent activities ──
      const { data: acts } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);

      if (acts) setRecentActivities(acts as ActivityData[]);

    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboardData(); }, []);

  // ── Derived chart data (pure, reactive, zero extra fetches) ──────────────

  const trendData = useMemo(
    () => computeTrend(allCandidates, trendPeriod, selectedJobId),
    [allCandidates, trendPeriod, selectedJobId]
  );

  const sourceData = useMemo(
    () => computeSources(allCandidates, selectedJobId),
    [allCandidates, selectedJobId]
  );

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

  const getActivityColor = (action: string) => {
    if (action.includes('CV')) return 'bg-blue-500';
    if (action.includes('Tạo') || action.includes('công việc')) return 'bg-green-500';
    if (action.includes('Phỏng vấn') || action.includes('phỏng vấn')) return 'bg-purple-500';
    if (action.includes('Đánh giá')) return 'bg-orange-500';
    if (action.includes('Cập nhật')) return 'bg-yellow-500';
    if (action.includes('Email') || action.includes('email')) return 'bg-pink-500';
    return 'bg-gray-500';
  };

  const TrendTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        <p className="text-sm text-gray-600">
          Số CV: <span className="font-bold text-blue-600">{payload[0].value}</span>
        </p>
      </div>
    );
  };

  const SourceTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
        <p className="font-semibold">{payload[0].name}</p>
        <p className="text-sm text-gray-600">
          Số lượng: <span className="font-bold">{payload[0].value}</span>
        </p>
      </div>
    );
  };

  const hasTrendData = trendData.some(d => d.count > 0);
  const hasSourceData = sourceData.some(s => s.count > 0);
  const selectedJobTitle =
    selectedJobId === 'all' ? 'Tất cả vị trí' : openJobs.find(j => j.id === selectedJobId)?.title ?? '';

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

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.stats.totalCV')}</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
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
            <Briefcase className="h-4 w-4 text-muted-foreground" />
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
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.interviewingCV}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {renderChangeIndicator(stats.interviewingChange)} {t('dashboard.stats.comparedToLastMonth')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── ROW 1: Top vị trí + Hoạt động gần đây (ngang hàng) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">

        {/* Top vị trí tuyển dụng */}
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
                        index < 3
                          ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" title={job.title}>{job.title}</p>
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
                      ) : t('dashboard.topJobs.normal')}
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

        {/* Hoạt động gần đây */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{t('dashboard.charts.recentActivities')}</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            {recentActivities.length > 0 ? (
              <ul className="space-y-4">
                {recentActivities.map((activity) => (
                  <li key={activity.id} className="flex items-start gap-3">
                    <span className={`block w-2.5 h-2.5 mt-1.5 rounded-full flex-shrink-0 ${getActivityColor(activity.action)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.user_name}</p>
                      <p className="text-sm text-gray-600">
                        {activity.action}
                        {activity.details && <span className="text-gray-500"> • {activity.details}</span>}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(activity.created_at).toLocaleString('vi-VN', {
                          year: 'numeric', month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit',
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

      {/* ── ROW 2: Vị trí đang tuyển — full width ── */}
      <Card className="bg-white shadow-sm">
        <CardHeader className="p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Briefcase className="w-5 h-5 text-blue-500" />
                Vị trí đang tuyển
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Tổng: <span className="font-semibold text-blue-600">{openJobs.length} vị trí</span> đang tuyển dụng
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Job dropdown */}
              <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                <SelectTrigger className="w-[220px] text-sm">
                  <SelectValue placeholder="Chọn vị trí..." />
                </SelectTrigger>
                <SelectContent className="bg-white z-50 shadow-lg border border-gray-200">
                  <SelectItem value="all">Tất cả vị trí</SelectItem>
                  {openJobs.map(job => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title} ({job.candidate_count} CV)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Period toggle */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                {(['day', 'month', 'year'] as TrendPeriod[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setTrendPeriod(p)}
                    className={`px-3 py-1.5 transition-colors ${
                      trendPeriod === p
                        ? 'bg-blue-600 text-white font-medium'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {{ day: 'Ngày', month: 'Tháng', year: 'Năm' }[p]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selectedJobId !== 'all' && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-gray-500">Đang xem:</span>
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border border-blue-200">
                {selectedJobTitle}
              </Badge>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-3 sm:p-6 pt-0">

          {/* Chip row */}
          {openJobs.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setSelectedJobId('all')}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                  selectedJobId === 'all'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                Tất cả
                <span className={`ml-1.5 font-semibold ${selectedJobId === 'all' ? 'text-blue-100' : 'text-gray-400'}`}>
                  {allCandidates.length}
                </span>
              </button>
              {openJobs.map(job => (
                <button
                  key={job.id}
                  onClick={() => setSelectedJobId(prev => prev === job.id ? 'all' : job.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    selectedJobId === job.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  {job.title}
                  <span className={`ml-1.5 font-semibold ${selectedJobId === job.id ? 'text-blue-100' : 'text-gray-400'}`}>
                    {job.candidate_count}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Two charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">

            {/* Xu hướng CV */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Xu hướng CV theo thời gian</h3>
                <span className="text-xs text-gray-400">{PERIOD_LABELS[trendPeriod]}</span>
              </div>
              <div className="h-[260px]">
                {!hasTrendData ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Database className="w-12 h-12 mb-2" />
                    <p className="text-sm">Chưa có dữ liệu trong khoảng thời gian này</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis
                        dataKey="label"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                        tick={{ fill: '#6b7280' }}
                      />
                      <YAxis
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        tick={{ fill: '#6b7280' }}
                      />
                      <Tooltip content={<TrendTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                        activeDot={{ r: 6 }}
                        name="Số CV"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Nguồn ứng viên */}
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
                      <Pie
                        data={sourceData as any[]}
                        dataKey="count"
                        nameKey="source"
                        cx="50%"
                        cy="45%"
                        outerRadius={80}
                        label={false}
                        labelLine={false}
                      >
                        {sourceData.map((_, i) => (
                          <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<SourceTooltip />} />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value: any, entry: any) =>
                          `${value} (${entry.payload.count})`
                        }
                        wrapperStyle={{ fontSize: '11px' }}
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