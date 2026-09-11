import { useState, useEffect, useRef } from 'react';
import {
  BookOpen, Calendar, PlayCircle, Users, Plus, Edit2, Trash2, X,
  Lock, Unlock, Eye, EyeOff, ChevronRight, ArrowLeft, Save, Loader2,
  CreditCard, CheckCircle2, XCircle, Clock, ExternalLink, Upload,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Grade, Month, Video, Profile, StudentAccess, PaymentRequest } from '@/types';

type Tab = 'overview' | 'grades' | 'months' | 'videos' | 'access' | 'payments';
type EditState =
  | { type: 'grade'; data: Grade | null }
  | { type: 'month'; data: Month | null; gradeId: string }
  | { type: 'video'; data: Video | null; monthId: string }
  | null;

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const [grades, setGrades] = useState<Grade[]>([]);
  const [months, setMonths] = useState<Month[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [accessMap, setAccessMap] = useState<Record<string, Record<string, boolean>>>({});
  const [payments, setPayments] = useState<(PaymentRequest & { student_name: string; student_phone: string; month_name: string; year: number; grade_name: string })[]>([]);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [payNote, setPayNote] = useState('');
  const [payAction, setPayAction] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [editing, setEditing] = useState<EditState>(null);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Month | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await loadGrades();
      loadStudents();
      loadPayments();
    })();
  }, []);

  async function loadGrades() {
    const { data } = await supabase.from('grades').select('*').order('display_order');
    setGrades((data as Grade[]) || []);
    setLoading(false);
  }

  async function loadMonths(grade?: Grade) {
    const g = grade || selectedGrade;
    if (!g) return;
    setSelectedGrade(g);
    const { data } = await supabase
      .from('months')
      .select('*')
      .eq('grade_id', g.id)
      .order('year', { ascending: false })
      .order('created_at', { ascending: false });
    setMonths((data as Month[]) || []);
  }

  async function loadVideos(month: Month) {
    setSelectedMonth(month);
    const { data } = await supabase
      .from('videos')
      .select('*')
      .eq('month_id', month.id)
      .order('created_at', { ascending: false });
    setVideos((data as Video[]) || []);
  }

  async function loadStudents() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('created_at', { ascending: false });
    const studentList = (data as Profile[]) || [];
    setStudents(studentList);

    const { data: access } = await supabase.from('student_access').select('*');
    const map: Record<string, Record<string, boolean>> = {};
    (access as StudentAccess[])?.forEach((a) => {
      if (!map[a.user_id]) map[a.user_id] = {};
      map[a.user_id][a.month_id] = a.has_access;
    });
    setAccessMap(map);
  }

  async function loadPayments() {
    const { data } = await supabase
      .from('payment_requests')
      .select('*, profiles!inner(name, phone), months!inner(month_name, year, grade_id)')
      .order('created_at', { ascending: false });
    const rows = (data || []) as unknown as Array<PaymentRequest & {
      profiles: { name: string; phone: string };
      months: { month_name: string; year: number; grade_id: string };
    }>;
    const enriched = rows.map((r) => {
      const grade = grades.find((g) => g.id === r.months.grade_id);
      return {
        ...r,
        student_name: r.profiles?.name || 'Unknown',
        student_phone: r.profiles?.phone || '',
        month_name: r.months?.month_name || '',
        year: r.months?.year || 0,
        grade_name: grade?.grade_name || '',
      };
    });
    setPayments(enriched);
  }

  async function approvePayment(id: string, note: string) {
    setPayAction({ id, action: 'approve' });
    const { error } = await supabase.rpc('approve_payment', { p_request_id: id, p_note: note });
    if (error) {
      console.error('Approve failed', error);
      alert('Could not approve this payment. Please try again.');
    }
    setPayAction(null);
    setPayNote('');
    loadPayments();
    loadStudents();
  }

  async function rejectPayment(id: string, note: string) {
    setPayAction({ id, action: 'reject' });
    const { error } = await supabase.rpc('reject_payment', { p_request_id: id, p_note: note });
    if (error) {
      console.error('Reject failed', error);
      alert('Could not reject this payment. Please try again.');
    }
    setPayAction(null);
    setPayNote('');
    loadPayments();
  }

  async function clearPayment(id: string) {
    if (!confirm('Remove this payment request from history? This cannot be undone.')) return;
    const { error } = await supabase.from('payment_requests').delete().eq('id', id);
    if (error) {
      console.error('Clear failed', error);
      alert('Could not clear this payment request. Please try again.');
    }
    loadPayments();
  }

  async function clearAllProcessed() {
    const processed = payments.filter((p) => p.status !== 'pending');
    if (processed.length === 0) return;
    if (!confirm(`Remove ${processed.length} processed payment request(s) from history? This cannot be undone.`)) return;
    const ids = processed.map((p) => p.id);
    const { error } = await supabase.from('payment_requests').delete().in('id', ids);
    if (error) {
      console.error('Clear all failed', error);
      alert('Could not clear payment history. Please try again.');
    }
    loadPayments();
  }

  async function toggleMonthLock(month: Month) {
    await supabase.from('months').update({ is_locked: !month.is_locked }).eq('id', month.id);
    loadMonths();
  }

  async function toggleVideoPublish(video: Video) {
    await supabase.from('videos').update({ is_published: !video.is_published }).eq('id', video.id);
    if (selectedMonth) loadVideos(selectedMonth);
  }

  async function toggleAccess(student: Profile, month: Month) {
    const current = accessMap[student.id]?.[month.id];
    if (current === undefined) {
      await supabase.from('student_access').insert({
        user_id: student.id,
        month_id: month.id,
        has_access: true,
      });
    } else {
      await supabase.from('student_access')
        .update({ has_access: !current })
        .eq('user_id', student.id)
        .eq('month_id', month.id);
    }
    loadStudents();
  }

  async function deleteGrade(grade: Grade) {
    if (!confirm(`Delete ${grade.grade_name}? This will delete all months and videos under it.`)) return;
    await supabase.from('grades').delete().eq('id', grade.id);
    loadGrades();
  }

  async function deleteMonth(month: Month) {
    if (!confirm(`Delete ${month.month_name} ${month.year}? This will delete all videos under it.`)) return;
    await supabase.from('months').delete().eq('id', month.id);
    loadMonths();
  }

  async function deleteVideo(video: Video) {
    if (!confirm(`Delete "${video.title}"?`)) return;
    await supabase.from('videos').delete().eq('id', video.id);
    if (selectedMonth) loadVideos(selectedMonth);
  }

  const tabs: { key: Tab; label: string; icon: typeof BookOpen }[] = [
    { key: 'overview', label: 'Overview', icon: BookOpen },
    { key: 'grades', label: 'Grades', icon: BookOpen },
    { key: 'months', label: 'Months', icon: Calendar },
    { key: 'videos', label: 'Videos', icon: PlayCircle },
    { key: 'access', label: 'Student Access', icon: Users },
    { key: 'payments', label: 'Payments', icon: CreditCard },
  ];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-app rounded-xl" />
          <div className="h-40 bg-app rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
      <p className="text-muted mb-8">Manage grades, months, videos, and student access</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 overflow-x-auto scrollbar-thin pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
              tab === t.key
                ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                : 'bg-surface text-muted hover:text-app border border-app'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 animate-fade-in">
          <StatCard label="Grades" value={grades.length} icon={BookOpen} color="primary" />
          <StatCard label="Months" value={months.length || '—'} icon={Calendar} color="accent" />
          <StatCard label="Videos" value={videos.length || '—'} icon={PlayCircle} color="success" />
          <StatCard label="Students" value={students.length} icon={Users} color="warning" />
          <StatCard label="Pending Payments" value={payments.filter((p) => p.status === 'pending').length} icon={CreditCard} color="accent" />
        </div>
      )}

      {/* Grades management */}
      {tab === 'grades' && (
        <div className="animate-fade-in">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-xl font-bold">All Grades</h2>
            <button
              onClick={() => setEditing({ type: 'grade', data: null })}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Grade
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {grades.map((grade) => (
              <div key={grade.id} className="bg-surface rounded-2xl p-5 border border-app group">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{grade.grade_name}</h3>
                    <p className="text-sm text-muted">Order: {grade.display_order}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditing({ type: 'grade', data: grade })} className="p-2 rounded-lg hover:bg-app text-muted hover:text-app">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteGrade(grade)} className="p-2 rounded-lg hover:bg-error-50 dark:hover:bg-error-900/20 text-muted hover:text-error-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Months management */}
      {tab === 'months' && (
        <div className="animate-fade-in">
          <div className="flex flex-wrap gap-3 mb-6">
            {grades.map((g) => (
              <button
                key={g.id}
                onClick={() => loadMonths(g)}
                className={`px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
                  selectedGrade?.id === g.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-surface border border-app text-muted hover:text-app'
                }`}
              >
                {g.grade_name}
              </button>
            ))}
          </div>
          {selectedGrade && (
            <>
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-bold">{selectedGrade.grade_name} — Months</h2>
                <button
                  onClick={() => setEditing({ type: 'month', data: null, gradeId: selectedGrade.id })}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Month
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {months.map((month) => (
                  <div key={month.id} className="bg-surface rounded-2xl p-5 border border-app group">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold">{month.month_name}</h3>
                        <p className="text-sm text-muted">{month.year}</p>
                      </div>
                      <button
                        onClick={() => toggleMonthLock(month)}
                        className={`p-2 rounded-lg transition-colors ${
                          month.is_locked
                            ? 'text-warning-600 hover:bg-warning-50 dark:hover:bg-warning-900/20'
                            : 'text-success-600 hover:bg-success-50 dark:hover:bg-success-900/20'
                        }`}
                      >
                        {month.is_locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      month.is_locked
                        ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400'
                        : 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400'
                    }`}>
                      {month.is_locked ? 'Locked' : 'Open'}
                    </span>
                    <div className="mt-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditing({ type: 'month', data: month, gradeId: selectedGrade.id })} className="p-2 rounded-lg hover:bg-app text-muted hover:text-app">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteMonth(month)} className="p-2 rounded-lg hover:bg-error-50 dark:hover:bg-error-900/20 text-muted hover:text-error-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {months.length === 0 && <EmptyState text="No months yet. Add one to get started." />}
            </>
          )}
          {!selectedGrade && grades.length > 0 && <p className="text-muted">Select a grade above to manage its months.</p>}
        </div>
      )}

      {/* Videos management */}
      {tab === 'videos' && (
        <div className="animate-fade-in">
          <div className="flex flex-wrap gap-3 mb-4">
            {grades.map((g) => (
              <button
                key={g.id}
                onClick={() => { setSelectedGrade(g); loadMonths(g); setSelectedMonth(null); setVideos([]); }}
                className={`px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
                  selectedGrade?.id === g.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-surface border border-app text-muted hover:text-app'
                }`}
              >
                {g.grade_name}
              </button>
            ))}
          </div>
          {selectedGrade && (
            <div className="flex flex-wrap gap-3 mb-6">
              {months.map((m) => (
                <button
                  key={m.id}
                  onClick={() => loadVideos(m)}
                  className={`px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
                    selectedMonth?.id === m.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface border border-app text-muted hover:text-app'
                  }`}
                >
                  {m.month_name} {m.year}
                </button>
              ))}
            </div>
          )}
          {selectedMonth && (
            <>
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-bold">{selectedMonth.month_name} {selectedMonth.year} — Videos</h2>
                <button
                  onClick={() => setEditing({ type: 'video', data: null, monthId: selectedMonth.id })}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Video
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {videos.map((video) => (
                  <div key={video.id} className="bg-surface rounded-2xl overflow-hidden border border-app group">
                    <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                      {video.thumbnail_url ? (
                        <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                      ) : (
                        <PlayCircle className="w-12 h-12 text-white/40" />
                      )}
                      <span className={`absolute top-3 right-3 text-xs px-2 py-1 rounded-full font-medium ${
                        video.is_published
                          ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400'
                          : 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400'
                      }`}>
                        {video.is_published ? 'Published' : 'Hidden'}
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold mb-1">{video.title}</h3>
                      <p className="text-sm text-muted line-clamp-1 mb-3">{video.description}</p>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleVideoPublish(video)} className="p-2 rounded-lg hover:bg-app text-muted hover:text-app" title="Toggle visibility">
                          {video.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setEditing({ type: 'video', data: video, monthId: selectedMonth.id })} className="p-2 rounded-lg hover:bg-app text-muted hover:text-app">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteVideo(video)} className="p-2 rounded-lg hover:bg-error-50 dark:hover:bg-error-900/20 text-muted hover:text-error-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {videos.length === 0 && <EmptyState text="No videos yet. Add one to get started." />}
            </>
          )}
          {!selectedMonth && <p className="text-muted">Select a grade and month above to manage videos.</p>}
        </div>
      )}

      {/* Student access management */}
      {tab === 'access' && (
        <div className="animate-fade-in">
          <h2 className="text-xl font-bold mb-5">Student Access Control</h2>
          {students.length === 0 ? (
            <EmptyState text="No students registered yet." />
          ) : (
            <div className="space-y-4">
              {students.map((student) => {
                const studentAccess = accessMap[student.id] || {};
                return (
                  <AccessCard
                    key={student.id}
                    student={student}
                    grades={grades}
                    accessMap={studentAccess}
                    onToggle={(month) => toggleAccess(student, month)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Payments management */}
      {tab === 'payments' && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h2 className="text-xl font-bold">Payment Requests</h2>
            {payments.some((p) => p.status !== 'pending') && (
              <button
                onClick={clearAllProcessed}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-app text-muted hover:text-error-600 hover:border-error-300 dark:hover:border-error-800 font-medium text-sm transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Clear Processed History
              </button>
            )}
          </div>
          {payments.length === 0 ? (
            <EmptyState text="No payment requests yet." />
          ) : (
            <div className="space-y-4">
              {payments.map((p) => (
                <div key={p.id} className="bg-surface rounded-2xl border border-app overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold">
                          {p.student_name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="font-medium">{p.student_name}</div>
                          <div className="text-sm text-muted">{p.student_phone || 'No phone'}</div>
                        </div>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 ${
                        p.status === 'pending'
                          ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400'
                          : p.status === 'approved'
                            ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400'
                            : 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400'
                      }`}>
                        {p.status === 'pending' && <Clock className="w-3 h-3" />}
                        {p.status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
                        {p.status === 'rejected' && <XCircle className="w-3 h-3" />}
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center gap-4 text-sm text-muted flex-wrap">
                      <span className="font-medium text-app">{p.grade_name}</span>
                      <span>·</span>
                      <span>{p.month_name} {p.year}</span>
                      <span>·</span>
                      <span>{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>

                    {p.admin_note && (p.status === 'rejected' || p.status === 'approved') && (
                      <div className="mt-3 text-sm text-muted">
                        <span className="font-medium">Admin note:</span> {p.admin_note}
                      </div>
                    )}

                    <div className="mt-4 flex items-center gap-3 flex-wrap">
                      <button
                        onClick={async () => {
                          const { data } = await supabase.storage.from('bank-slips').createSignedUrl(p.slip_url, 300);
                          if (data?.signedUrl) setSlipPreview(data.signedUrl);
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-app hover:bg-app text-app font-medium text-sm transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" /> View Slip
                      </button>

                      {p.status === 'pending' && (
                        <>
                          <input
                            type="text"
                            value={payNote}
                            onChange={(e) => setPayNote(e.target.value)}
                            placeholder="Optional note for student..."
                            className="flex-1 min-w-[180px] px-4 py-2 rounded-xl bg-app border-2 border-app text-app placeholder:text-muted focus:border-primary-500 focus:outline-none text-sm transition-colors"
                          />
                          <button
                            onClick={() => approvePayment(p.id, payNote)}
                            disabled={payAction?.id === p.id}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-success-600 hover:bg-success-700 disabled:opacity-60 text-white font-medium text-sm transition-colors"
                          >
                            {payAction?.id === p.id && payAction.action === 'approve'
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <CheckCircle2 className="w-4 h-4" />}
                            Approve
                          </button>
                          <button
                            onClick={() => rejectPayment(p.id, payNote)}
                            disabled={payAction?.id === p.id}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-error-600 hover:bg-error-700 disabled:opacity-60 text-white font-medium text-sm transition-colors"
                          >
                            {payAction?.id === p.id && payAction.action === 'reject'
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <XCircle className="w-4 h-4" />}
                            Reject
                          </button>
                        </>
                      )}
                      {p.status !== 'pending' && (
                        <button
                          onClick={() => clearPayment(p.id)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-app text-muted hover:text-error-600 hover:border-error-300 dark:hover:border-error-800 font-medium text-sm transition-colors"
                        >
                          <Trash2 className="w-4 h-4" /> Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Slip preview modal */}
      {slipPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSlipPreview(null)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative z-10 max-w-2xl w-full">
            <button
              onClick={() => setSlipPreview(null)}
              className="absolute -top-10 right-0 p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={slipPreview} alt="Bank slip" className="w-full rounded-2xl" />
          </div>
        </div>
      )}

      {/* Edit modals */}
      {editing && (
        <EditModal editing={editing} grades={grades} onClose={() => setEditing(null)} onSave={() => {
          if (editing.type === 'grade') loadGrades();
          if (editing.type === 'month') loadMonths();
          if (editing.type === 'video' && selectedMonth) loadVideos(selectedMonth);
          setEditing(null);
        }} />
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: typeof BookOpen; color: string }) {
  const colors: Record<string, string> = {
    primary: 'from-primary-500 to-primary-700',
    accent: 'from-accent-500 to-accent-700',
    success: 'from-success-500 to-success-700',
    warning: 'from-warning-500 to-warning-600',
  };
  return (
    <div className="bg-surface rounded-2xl p-5 border border-app">
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white mb-4`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm text-muted mt-1">{label}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-16 text-muted">
      <p>{text}</p>
    </div>
  );
}

function AccessCard({ student, grades, accessMap, onToggle }: {
  student: Profile;
  grades: Grade[];
  accessMap: Record<string, boolean>;
  onToggle: (month: Month) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
  const [localMonths, setLocalMonths] = useState<Month[]>([]);

  async function loadLocalMonths(grade: Grade) {
    const { data } = await supabase
      .from('months')
      .select('*')
      .eq('grade_id', grade.id)
      .order('year', { ascending: false })
      .order('created_at', { ascending: false });
    setLocalMonths((data as Month[]) || []);
  }

  return (
    <div className="bg-surface rounded-2xl border border-app overflow-hidden">
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold">
            {student.name?.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <div className="font-medium">{student.name || 'Unnamed'}</div>
            <div className="text-sm text-muted">{student.phone || 'No phone'}</div>
          </div>
        </div>
        <button
          onClick={() => {
            setExpanded(!expanded);
            if (!expanded && grades.length > 0) {
              setSelectedGrade(grades[0]);
              loadLocalMonths(grades[0]);
            }
          }}
          className="px-3 py-1.5 rounded-lg text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
        >
          {expanded ? 'Close' : 'Manage Access'}
        </button>
      </div>
      {expanded && (
        <div className="border-t border-app p-5 animate-fade-in">
          <div className="flex flex-wrap gap-2 mb-4">
            {grades.map((g) => (
              <button
                key={g.id}
                onClick={() => { setSelectedGrade(g); loadLocalMonths(g); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedGrade?.id === g.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-app text-muted hover:text-app'
                }`}
              >
                {g.grade_name}
              </button>
            ))}
          </div>
          {selectedGrade && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {localMonths.map((month) => {
                const hasAccess = accessMap[month.id];
                return (
                  <button
                    key={month.id}
                    onClick={() => onToggle(month)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all flex items-center justify-between ${
                      hasAccess
                        ? 'border-success-500 bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400'
                        : month.is_locked
                          ? 'border-warning-300 dark:border-warning-800 text-warning-700 dark:text-warning-400'
                          : 'border-app text-muted'
                    }`}
                  >
                    <span>{month.month_name}</span>
                    {hasAccess ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </button>
                );
              })}
              {localMonths.length === 0 && <p className="text-sm text-muted col-span-full">No months for this grade.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditModal({ editing, grades, onClose, onSave }: {
  editing: NonNullable<EditState>;
  grades: Grade[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [saving, setSaving] = useState(false);

  if (editing.type === 'grade') {
    return <GradeForm grade={editing.data} saving={saving} onClose={onClose} onSave={async (data) => {
      setSaving(true);
      if (editing.data) {
        await supabase.from('grades').update(data).eq('id', editing.data.id);
      } else {
        await supabase.from('grades').insert(data);
      }
      setSaving(false);
      onSave();
    }} />;
  }

  if (editing.type === 'month') {
    return <MonthForm month={editing.data} gradeId={editing.gradeId} grades={grades} saving={saving} onClose={onClose} onSave={async (data) => {
      setSaving(true);
      if (editing.data) {
        await supabase.from('months').update(data).eq('id', editing.data.id);
      } else {
        await supabase.from('months').insert({ ...data, grade_id: editing.gradeId });
      }
      setSaving(false);
      onSave();
    }} />;
  }

  if (editing.type === 'video') {
    return <VideoForm video={editing.data} monthId={editing.monthId} saving={saving} onClose={onClose} onSave={async (data) => {
      setSaving(true);
      if (editing.data) {
        await supabase.from('videos').update(data).eq('id', editing.data.id);
      } else {
        await supabase.from('videos').insert({ ...data, month_id: editing.monthId });
      }
      setSaving(false);
      onSave();
    }} />;
  }

  return null;
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-surface rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-app sticky top-0 bg-surface z-10">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-app text-muted">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function GradeForm({ grade, saving, onClose, onSave }: {
  grade: Grade | null;
  saving: boolean;
  onClose: () => void;
  onSave: (data: { grade_name: string; display_order: number }) => void;
}) {
  const [name, setName] = useState(grade?.grade_name || '');
  const [order, setOrder] = useState(grade?.display_order ?? 1);
  return (
    <ModalShell title={grade ? 'Edit Grade' : 'Add Grade'} onClose={onClose}>
      <div className="space-y-4">
        <FormInput label="Grade Name" value={name} onChange={setName} placeholder="e.g. Grade 9" />
        <FormInput label="Display Order" type="number" value={String(order)} onChange={(v) => setOrder(parseInt(v) || 0)} />
        <SubmitButton saving={saving} onClose={onClose} onClick={() => onSave({ grade_name: name, display_order: order })} disabled={!name} />
      </div>
    </ModalShell>
  );
}

function MonthForm({ month, grades, gradeId, saving, onClose, onSave }: {
  month: Month | null;
  grades: Grade[];
  gradeId: string;
  saving: boolean;
  onClose: () => void;
  onSave: (data: { month_name: string; year: number; is_locked: boolean }) => void;
}) {
  const [name, setName] = useState(month?.month_name || '');
  const [year, setYear] = useState(month?.year || new Date().getFullYear());
  const [locked, setLocked] = useState(month?.is_locked ?? false);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const grade = grades.find((g) => g.id === gradeId);
  return (
    <ModalShell title={month ? 'Edit Month' : 'Add Month'} onClose={onClose}>
      <div className="space-y-4">
        <div className="text-sm text-muted mb-2">Grade: <span className="font-medium text-app">{grade?.grade_name}</span></div>
        <div>
          <label className="block text-sm font-medium text-muted mb-2">Month</label>
          <select value={name} onChange={(e) => setName(e.target.value)} className={selectClass}>
            <option value="">Select month...</option>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <FormInput label="Year" type="number" value={String(year)} onChange={(v) => setYear(parseInt(v) || 2026)} />
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            onClick={() => setLocked(!locked)}
            className={`relative w-11 h-6 rounded-full transition-colors ${locked ? 'bg-warning-500' : 'bg-app'}`}
          >
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${locked ? 'translate-x-5' : ''}`} />
          </button>
          <span className="text-sm">Lock this month (requires explicit access grant)</span>
        </label>
        <SubmitButton saving={saving} onClose={onClose} onClick={() => onSave({ month_name: name, year, is_locked: locked })} disabled={!name} />
      </div>
    </ModalShell>
  );
}

function VideoForm({ video, monthId, saving, onClose, onSave }: {
  video: Video | null;
  monthId: string;
  saving: boolean;
  onClose: () => void;
  onSave: (data: { title: string; description: string; video_url: string; quality_urls: { label: string; url: string }[]; duration: string; thumbnail_url: string; is_published: boolean }) => void;
}) {
  const [title, setTitle] = useState(video?.title || '');
  const [desc, setDesc] = useState(video?.description || '');
  const [url, setUrl] = useState(video?.video_url || '');
  const [duration, setDuration] = useState(video?.duration || '');
  const [thumbnail, setThumbnail] = useState(video?.thumbnail_url || '');
  const [published, setPublished] = useState(video?.is_published ?? true);
  const [qualities, setQualities] = useState(video?.quality_urls || []);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const videoFileRef = useRef<HTMLInputElement>(null);
  const qualityFileRefs = useRef<(HTMLInputElement | null)[]>([]);

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const allowed = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska'];
    if (!allowed.includes(f.type) && !f.name.match(/\.(mp4|webm|ogg|mov|mkv)$/i)) {
      setUploadError('Please upload a video file (MP4, WebM, MOV, or OGG).');
      return;
    }
    if (f.size > 500 * 1024 * 1024) {
      setUploadError('File too large. Maximum 500MB.');
      return;
    }
    setUploading(true);
    setUploadError('');
    setUploadProgress(0);

    try {
      const ext = f.name.split('.').pop() || 'mp4';
      const fileName = `${monthId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError2 } = await supabase.storage
        .from('videos')
        .upload(fileName, f, {
          contentType: f.type || 'video/mp4',
          upsert: false,
        });

      if (uploadError2) throw uploadError2;

      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName);
      setUrl(urlData.publicUrl);
      setUploadProgress(100);
    } catch (err) {
      console.error('Video upload failed', err);
      setUploadError('Could not upload the video. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleQualityUpload(e: React.ChangeEvent<HTMLInputElement>, index: number) {
    const f = e.target.files?.[0];
    if (!f) return;
    const allowed = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska'];
    if (!allowed.includes(f.type) && !f.name.match(/\.(mp4|webm|ogg|mov|mkv)$/i)) {
      setUploadError('Please upload a video file.');
      return;
    }
    if (f.size > 500 * 1024 * 1024) {
      setUploadError('File too large. Maximum 500MB.');
      return;
    }
    setUploading(true);
    setUploadError('');

    try {
      const ext = f.name.split('.').pop() || 'mp4';
      const fileName = `${monthId}/${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('videos')
        .upload(fileName, f, { contentType: f.type || 'video/mp4', upsert: false });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName);
      updateQuality(index, 'url', urlData.publicUrl);
      if (!qualities[index].label) {
        const label = f.name.includes('1080') ? '1080p' : f.name.includes('720') ? '720p' : f.name.includes('480') ? '480p' : `Quality ${index + 1}`;
        updateQuality(index, 'label', label);
      }
    } catch (err) {
      console.error('Quality upload failed', err);
      setUploadError('Could not upload the quality variant. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function addQuality() {
    setQualities([...qualities, { label: '', url: '' }]);
  }

  function updateQuality(i: number, field: 'label' | 'url', val: string) {
    const updated = [...qualities];
    updated[i][field] = val;
    setQualities(updated);
  }

  function removeQuality(i: number) {
    setQualities(qualities.filter((_, idx) => idx !== i));
  }

  return (
    <ModalShell title={video ? 'Edit Video' : 'Add Video'} onClose={onClose}>
      <div className="space-y-4">
        <FormInput label="Title" value={title} onChange={setTitle} placeholder="Lesson title" />
        <div>
          <label className="block text-sm font-medium text-muted mb-2">Description</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className={inputClass} placeholder="What is this lesson about?" />
        </div>

        {/* Video source: URL or upload */}
        <div>
          <label className="block text-sm font-medium text-muted mb-2">Video Source</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={inputClass}
            placeholder="Paste a URL (YouTube, Vimeo, or direct video link)..."
          />
          <div className="flex items-center gap-3 mt-2">
            <div className="flex-1 h-px bg-app" />
            <span className="text-xs text-muted">or</span>
            <div className="flex-1 h-px bg-app" />
          </div>
          <button
            type="button"
            onClick={() => videoFileRef.current?.click()}
            disabled={uploading}
            className="w-full mt-2 border-2 border-dashed border-app rounded-xl p-6 flex flex-col items-center justify-center gap-2 hover:border-primary-500 transition-colors disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                <span className="text-sm text-muted">Uploading... {uploadProgress > 0 && `${uploadProgress}%`}</span>
              </>
            ) : url && !url.includes('youtube') && !url.includes('vimeo') ? (
              <>
                <CheckCircle2 className="w-6 h-6 text-success-500" />
                <span className="text-sm font-medium text-success-600 dark:text-success-400">Video uploaded — click to replace</span>
              </>
            ) : (
              <>
                <Upload className="w-6 h-6 text-muted" />
                <span className="text-sm font-medium">Upload from device</span>
                <span className="text-xs text-muted">MP4, WebM, MOV up to 500MB</span>
              </>
            )}
          </button>
          <input
            ref={videoFileRef}
            type="file"
            accept="video/mp4,video/webm,video/ogg,video/quicktime,.mkv,.mov"
            onChange={handleVideoUpload}
            className="hidden"
          />
        </div>

        <FormInput label="Duration (display)" value={duration} onChange={setDuration} placeholder="e.g. 45:30" />
        <FormInput label="Thumbnail URL (optional)" value={thumbnail} onChange={setThumbnail} placeholder="https://..." />

        {/* Quality options */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-muted">Quality Options</label>
            <button type="button" onClick={addQuality} className="text-sm text-primary-600 dark:text-primary-400 font-medium hover:underline">+ Add quality</button>
          </div>
          {qualities.map((q, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input value={q.label} onChange={(e) => updateQuality(i, 'label', e.target.value)} placeholder="1080p" className={`${inputClass} w-24`} />
              <input value={q.url} onChange={(e) => updateQuality(i, 'url', e.target.value)} placeholder="https://..." className={inputClass} />
              <button
                type="button"
                onClick={() => qualityFileRefs.current[i]?.click()}
                disabled={uploading}
                className="p-2 rounded-lg hover:bg-app text-muted hover:text-primary-600 disabled:opacity-60"
                title="Upload from device"
              >
                <Upload className="w-4 h-4" />
              </button>
              <input
                ref={(el) => { qualityFileRefs.current[i] = el; }}
                type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime,.mkv,.mov"
                onChange={(e) => handleQualityUpload(e, i)}
                className="hidden"
              />
              <button type="button" onClick={() => removeQuality(i)} className="p-2 rounded-lg hover:bg-error-50 dark:hover:bg-error-900/20 text-muted hover:text-error-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {qualities.length === 0 && <p className="text-sm text-muted">No quality variants. The main URL will be used.</p>}
        </div>

        {uploadError && (
          <div className="px-4 py-3 rounded-xl bg-error-50 dark:bg-error-900/20 border border-error-100 dark:border-error-800 text-error-700 dark:text-error-400 text-sm">
            {uploadError}
          </div>
        )}

        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            onClick={() => setPublished(!published)}
            className={`relative w-11 h-6 rounded-full transition-colors ${published ? 'bg-success-500' : 'bg-app'}`}
          >
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${published ? 'translate-x-5' : ''}`} />
          </button>
          <span className="text-sm">Published (visible to students)</span>
        </label>

        <SubmitButton saving={saving || uploading} onClose={onClose} onClick={() => onSave({
          title, description: desc, video_url: url,
          quality_urls: qualities.filter((q) => q.label && q.url),
          duration, thumbnail_url: thumbnail, is_published: published,
        })} disabled={!title || !url || uploading} />
      </div>
    </ModalShell>
  );
}

const inputClass = 'w-full px-4 py-2.5 rounded-xl bg-app border-2 border-app text-app placeholder:text-muted focus:border-primary-500 focus:outline-none transition-colors text-sm';
const selectClass = 'w-full px-4 py-2.5 rounded-xl bg-app border-2 border-app text-app focus:border-primary-500 focus:outline-none transition-colors text-sm';

function FormInput({ label, value, onChange, placeholder, type }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-muted mb-2">{label}</label>
      <input
        type={type || 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
        placeholder={placeholder}
      />
    </div>
  );
}

function SubmitButton({ saving, onClose, onClick, disabled }: {
  saving: boolean;
  onClose: () => void;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-3 pt-2">
      <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border-2 border-app text-muted hover:text-app font-medium text-sm transition-colors">
        Cancel
      </button>
      <button
        onClick={onClick}
        disabled={saving || disabled}
        className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save
      </button>
    </div>
  );
}
