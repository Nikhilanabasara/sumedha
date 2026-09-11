import { useState, useEffect } from 'react';
import { ChevronRight, Lock, PlayCircle, Calendar, Clock, ArrowLeft, BookOpen, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Grade, Month, Video, StudentAccess, PaymentRequest } from '@/types';
import VideoPlayer from '@/components/VideoPlayer';
import PaymentModal from '@/components/PaymentModal';

type Stage = 'grades' | 'months' | 'videos' | 'player';

export default function StudentDashboard() {
  const { profile } = useAuth();
  const [stage, setStage] = useState<Stage>('grades');
  const [grades, setGrades] = useState<Grade[]>([]);
  const [months, setMonths] = useState<Month[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [accessMap, setAccessMap] = useState<Record<string, boolean>>({});
  const [paymentMap, setPaymentMap] = useState<Record<string, PaymentRequest>>({});
  const [payMonth, setPayMonth] = useState<Month | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Month | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGrades();
  }, []);

  async function loadGrades() {
    setLoading(true);
    const { data } = await supabase.from('grades').select('*').order('display_order');
    setGrades((data as Grade[]) || []);
    setLoading(false);
  }

  async function loadMonths(grade: Grade) {
    setLoading(true);
    setSelectedGrade(grade);
    const { data } = await supabase
      .from('months')
      .select('*')
      .eq('grade_id', grade.id)
      .order('year', { ascending: false })
      .order('created_at', { ascending: false });
    const monthData = (data as Month[]) || [];

    if (profile) {
      const { data: access } = await supabase
        .from('student_access')
        .select('*')
        .eq('user_id', profile.id);
      const map: Record<string, boolean> = {};
      (access as StudentAccess[])?.forEach((a) => {
        map[a.month_id] = a.has_access;
      });
      setAccessMap(map);

      const { data: payments } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('user_id', profile.id);
      const pMap: Record<string, PaymentRequest> = {};
      (payments as PaymentRequest[])?.forEach((p) => {
        pMap[p.month_id] = p;
      });
      setPaymentMap(pMap);
    }

    setMonths(monthData);
    setStage('months');
    setLoading(false);
  }

  async function loadVideos(month: Month) {
    if (month.is_locked && !accessMap[month.id]) return;
    setLoading(true);
    setSelectedMonth(month);
    const { data } = await supabase
      .from('videos')
      .select('*')
      .eq('month_id', month.id)
      .eq('is_published', true)
      .order('created_at');
    setVideos((data as Video[]) || []);
    setStage('videos');
    setLoading(false);
  }

  function playVideo(video: Video) {
    setSelectedVideo(video);
    setStage('player');
  }

  const breadcrumb = (
    <div className="flex items-center gap-1.5 text-sm text-muted mb-6 flex-wrap">
      <button onClick={() => { setStage('grades'); setSelectedGrade(null); }} className="hover:text-app transition-colors">
        Grades
      </button>
      {selectedGrade && (
        <>
          <ChevronRight className="w-4 h-4" />
          <button onClick={() => setStage('months')} className="hover:text-app transition-colors">
            {selectedGrade.grade_name}
          </button>
        </>
      )}
      {selectedMonth && stage !== 'months' && (
        <>
          <ChevronRight className="w-4 h-4" />
          <button onClick={() => setStage('videos')} className="hover:text-app transition-colors">
            {selectedMonth.month_name} {selectedMonth.year}
          </button>
        </>
      )}
      {selectedVideo && stage === 'player' && (
        <>
          <ChevronRight className="w-4 h-4" />
          <span className="text-app font-medium truncate max-w-[200px]">{selectedVideo.title}</span>
        </>
      )}
    </div>
  );

  if (loading && stage === 'grades') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-48 bg-app rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-app rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {breadcrumb}

      {/* Grades */}
      {stage === 'grades' && (
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">Choose Your Grade</h1>
          <p className="text-muted mb-8">Select a grade to browse monthly lessons</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {grades.map((grade) => (
              <button
                key={grade.id}
                onClick={() => loadMonths(grade)}
                className="group relative overflow-hidden rounded-2xl p-8 text-left bg-gradient-to-br from-primary-600 to-primary-800 text-white transition-transform hover:scale-[1.02] hover:shadow-2xl"
              >
                <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity" style={{
                  backgroundImage: 'radial-gradient(circle at 80% 20%, white 2px, transparent 2px)',
                  backgroundSize: '30px 30px',
                }} />
                <div className="relative z-10">
                  <BookOpen className="w-10 h-10 mb-4 text-white/80" />
                  <h3 className="text-2xl font-bold mb-1">{grade.grade_name}</h3>
                  <p className="text-white/70 text-sm">View monthly lessons</p>
                  <div className="mt-6 flex items-center gap-2 text-sm font-medium text-white/90 group-hover:gap-3 transition-all">
                    Explore <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Months */}
      {stage === 'months' && (
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">{selectedGrade?.grade_name}</h1>
          <p className="text-muted mb-8">Select a month to view lessons</p>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 bg-app rounded-2xl animate-pulse" />)}
            </div>
          ) : months.length === 0 ? (
            <div className="text-center py-20 text-muted">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>No months available yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {months.map((month) => {
                const locked = month.is_locked && !accessMap[month.id];
                const payment = paymentMap[month.id];
                return (
                  <div
                    key={month.id}
                    className={`group rounded-2xl p-6 text-left border-2 transition-all ${
                      locked
                        ? 'border-app bg-surface'
                        : 'border-app bg-surface hover:border-primary-500 hover:shadow-lg cursor-pointer'
                    }`}
                    onClick={() => !locked && loadVideos(month)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        locked ? 'bg-app text-muted' : 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                      }`}>
                        {locked ? <Lock className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
                      </div>
                      {month.is_locked && (
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          accessMap[month.id]
                            ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400'
                            : payment?.status === 'pending'
                              ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400'
                              : payment?.status === 'rejected'
                                ? 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400'
                                : 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400'
                        }`}>
                          {accessMap[month.id] ? 'Unlocked' : payment?.status === 'pending' ? 'Pending' : payment?.status === 'rejected' ? 'Rejected' : 'Locked'}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold mb-1">{month.month_name}</h3>
                    <p className="text-sm text-muted">{month.year}</p>
                    {locked ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); setPayMonth(month); }}
                        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition-colors"
                      >
                        <CreditCard className="w-4 h-4" />
                        {payment?.status === 'pending' ? 'Re-upload Slip' : payment?.status === 'rejected' ? 'Upload New Slip' : 'Purchase Access'}
                      </button>
                    ) : (
                      <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 group-hover:gap-3 transition-all">
                        View lessons <ChevronRight className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Videos list */}
      {stage === 'videos' && (
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">
            {selectedMonth?.month_name} {selectedMonth?.year}
          </h1>
          <p className="text-muted mb-8">{selectedGrade?.grade_name} · {videos.length} lessons</p>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-48 bg-app rounded-2xl animate-pulse" />)}
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-20 text-muted">
              <PlayCircle className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>No lessons published for this month yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {videos.map((video) => (
                <button
                  key={video.id}
                  onClick={() => playVideo(video)}
                  className="group text-left bg-surface rounded-2xl overflow-hidden border border-app hover:shadow-xl transition-all hover:scale-[1.01]"
                >
                  <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                    {video.thumbnail_url ? (
                      <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary-600 to-primary-900 flex items-center justify-center">
                        <PlayCircle className="w-14 h-14 text-white/70" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-white/0 group-hover:bg-white/90 transition-all flex items-center justify-center">
                        <PlayCircle className="w-8 h-8 text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    {video.duration && (
                      <span className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-black/70 text-white text-xs font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {video.duration}
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-lg mb-1.5 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {video.title}
                    </h3>
                    <p className="text-sm text-muted line-clamp-2">{video.description}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Player */}
      {stage === 'player' && selectedVideo && (
        <div className="animate-fade-in max-w-5xl">
          <button
            onClick={() => setStage('videos')}
            className="flex items-center gap-2 text-muted hover:text-app transition-colors mb-4 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Back to lessons
          </button>
          <VideoPlayer
            video={selectedVideo}
            watermarkText={`${profile?.phone || profile?.name || 'Student'} · ${profile?.id.slice(0, 8) || ''}`}
          />
          <div className="mt-6">
            <h1 className="text-2xl font-bold mb-2">{selectedVideo.title}</h1>
            <p className="text-muted leading-relaxed">{selectedVideo.description}</p>
            <div className="mt-4 flex items-center gap-4 text-sm text-muted">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {selectedMonth?.month_name} {selectedMonth?.year}
              </span>
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                {selectedGrade?.grade_name}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {payMonth && selectedGrade && profile && (
        <PaymentModal
          month={payMonth}
          gradeName={selectedGrade.grade_name}
          profileId={profile.id}
          existingRequest={paymentMap[payMonth.id] || null}
          onClose={() => setPayMonth(null)}
          onSubmitted={() => {
            setPayMonth(null);
            if (selectedGrade) loadMonths(selectedGrade);
          }}
        />
      )}
    </div>
  );
}
