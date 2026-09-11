import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Settings, Maximize, Volume2, VolumeX, Loader2 } from 'lucide-react';
import type { Video, QualityOption } from '@/types';

interface Props {
  video: Video;
  watermarkText: string;
}

type SourceType = 'file' | 'youtube' | 'vimeo';

function detectSource(url: string): SourceType {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('vimeo.com')) return 'vimeo';
  return 'file';
}

function getYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function getVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

export default function VideoPlayer({ video, watermarkText }: Props) {
  const url = video.video_url.trim();
  const sourceType = detectSource(url);

  if (sourceType === 'youtube') {
    return <YouTubePlayer videoId={getYouTubeId(url)} url={url} watermarkText={watermarkText} />;
  }
  if (sourceType === 'vimeo') {
    return <VimeoPlayer videoId={getVimeoId(url)} url={url} watermarkText={watermarkText} />;
  }
  return <FilePlayer video={video} watermarkText={watermarkText} />;
}

// ─── YouTube ───────────────────────────────────────────────
function YouTubePlayer({ videoId, url, watermarkText }: { videoId: string | null; url: string; watermarkText: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  const id = videoId;
  const embedUrl = id
    ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`
    : null;

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen();
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden group no-select"
      onContextMenu={(e) => e.preventDefault()}
    >
      {embedUrl ? (
        <iframe
          src={embedUrl}
          className="w-full h-full"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          title="Video player"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white/70 p-8 text-center">
          <div>
            <p className="mb-2">Could not parse this YouTube URL:</p>
            <p className="text-sm text-white/40 break-all">{url}</p>
          </div>
        </div>
      )}

      <Watermark text={watermarkText} />

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-12 pb-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="flex items-center justify-end">
          <button onClick={toggleFullscreen} className="text-white hover:text-primary-400 transition-colors pointer-events-auto">
            <Maximize className="w-5 h-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white/70 text-center p-8">
          This video could not be loaded. It may be private or restricted.
        </div>
      )}
    </div>
  );
}

// ─── Vimeo ─────────────────────────────────────────────────
function VimeoPlayer({ videoId, url, watermarkText }: { videoId: string | null; url: string; watermarkText: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const embedUrl = videoId
    ? `https://player.vimeo.com/video/${videoId}?playsinline=1`
    : null;

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen();
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden group no-select"
      onContextMenu={(e) => e.preventDefault()}
    >
      {embedUrl ? (
        <iframe
          src={embedUrl}
          className="w-full h-full"
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title="Video player"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white/70 p-8 text-center">
          <div>
            <p className="mb-2">Could not parse this Vimeo URL:</p>
            <p className="text-sm text-white/40 break-all">{url}</p>
          </div>
        </div>
      )}

      <Watermark text={watermarkText} />

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-12 pb-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="flex items-center justify-end">
          <button onClick={toggleFullscreen} className="text-white hover:text-primary-400 transition-colors pointer-events-auto">
            <Maximize className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Direct file (MP4, HLS, etc.) ──────────────────────────
function FilePlayer({ video, watermarkText }: { video: Video; watermarkText: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [showQuality, setShowQuality] = useState(false);
  const [quality, setQuality] = useState<string>('Auto');
  const [qualities, setQualities] = useState<QualityOption[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    const opts: QualityOption[] = Array.isArray(video.quality_urls) ? video.quality_urls : [];
    setQualities(opts);
    setLoading(true);
    setPlaying(false);
    setProgress(0);
    setCurrent(0);
    setError(false);
  }, [video.id, video.video_url]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => setError(true));
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function handleTimeUpdate() {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setCurrent(v.currentTime);
    setProgress((v.currentTime / v.duration) * 100);
  }

  function handleLoaded() {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
    setLoading(false);
    setError(false);
  }

  function handleError() {
    setLoading(false);
    setError(true);
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    v.currentTime = pct * v.duration;
  }

  function switchQuality(opt: QualityOption) {
    const v = videoRef.current;
    if (!v) return;
    const time = v.currentTime;
    const wasPlaying = !v.paused;
    setLoading(true);

    const onReady = () => {
      v.currentTime = time;
      v.removeEventListener('loadedmetadata', onReady);
      setLoading(false);
      if (wasPlaying) v.play().catch(() => {});
    };
    v.addEventListener('loadedmetadata', onReady);
    v.src = opt.url;
    v.load();
    setQuality(opt.label);
    setShowQuality(false);
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen();
  }

  function formatTime(s: number) {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden group no-select"
      onContextMenu={(e) => e.preventDefault()}
    >
      <video
        ref={videoRef}
        src={video.video_url}
        className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoaded}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onCanPlay={() => setLoading(false)}
        onError={handleError}
        onClick={togglePlay}
        playsInline
      />

      <Watermark text={watermarkText} />

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white/70 text-center p-8 z-20">
          <div>
            <p className="mb-2 font-medium text-white/90">This video could not be played.</p>
            <p className="text-sm text-white/40">The URL may be invalid or the video may not be publicly accessible.</p>
            <p className="text-xs text-white/30 mt-2 break-all max-w-md mx-auto">{video.video_url}</p>
          </div>
        </div>
      )}

      {/* Loading spinner */}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Loader2 className="w-10 h-10 text-white animate-spin" />
        </div>
      )}

      {/* Center play button */}
      {!playing && !loading && !error && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors">
            <Play className="w-8 h-8 text-white ml-1" fill="white" />
          </div>
        </button>
      )}

      {/* Controls bar */}
      {!error && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-12 pb-3 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Progress bar */}
          <div
            className="h-1.5 bg-white/30 rounded-full cursor-pointer mb-3 group/bar"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-primary-500 rounded-full relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary-400 rounded-full opacity-0 group-hover/bar:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={togglePlay} className="text-white hover:text-primary-400 transition-colors">
                {playing ? <Pause className="w-5 h-5" fill="white" /> : <Play className="w-5 h-5" fill="white" />}
              </button>
              <button onClick={toggleMute} className="text-white hover:text-primary-400 transition-colors">
                {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <span className="text-white text-sm font-medium">
                {formatTime(current)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-3 relative">
              {qualities.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowQuality((s) => !s)}
                    className="flex items-center gap-1.5 text-white hover:text-primary-400 transition-colors text-sm font-medium"
                  >
                    <Settings className="w-5 h-5" />
                    {quality}
                  </button>
                  {showQuality && (
                    <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur rounded-xl overflow-hidden min-w-[120px]">
                      {qualities.map((opt) => (
                        <button
                          key={opt.label}
                          onClick={() => switchQuality(opt)}
                          className={`block w-full px-4 py-2 text-sm text-left transition-colors ${
                            quality === opt.label
                              ? 'bg-primary-600 text-white'
                              : 'text-white/80 hover:bg-white/10'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button onClick={toggleFullscreen} className="text-white hover:text-primary-400 transition-colors">
                <Maximize className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared watermark overlay ──────────────────────────────
function Watermark({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 watermark-animate">
        <div className="text-white/20 text-lg font-bold whitespace-nowrap rotate-[-20deg] select-none">
          {text}
        </div>
      </div>
      <div className="absolute top-4 left-8 text-white/15 text-sm font-medium select-none">
        {text}
      </div>
      <div className="absolute bottom-12 right-8 text-white/15 text-sm font-medium select-none">
        {text}
      </div>
    </div>
  );
}
