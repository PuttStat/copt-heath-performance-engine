'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthGate } from '@/app/ui/auth-gate';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { VideoStatusBadge } from '@/src/components/video/VideoStatusBadge';

type SwingVideo = {
  id: string;
  swing_type: string;
  camera_view: string;
  club: string;
  status: string;
  created_at: string;
  player_question: string | null;
};

export default function PlayerVideosPage() {
  const [videos, setVideos] = useState<SwingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError('Video library is not configured.');
      setLoading(false);
      return;
    }

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('swing_videos')
        .select('id,swing_type,camera_view,club,status,created_at,player_question')
        .eq('player_id', user.id)
        .order('created_at', { ascending: false });

      if (queryError) setError('Your videos could not be loaded.');
      else setVideos((data ?? []) as SwingVideo[]);
      setLoading(false);
    });
  }, []);

  return (
    <AuthGate>
      <main className="video-page">
        <header>
          <div>
            <p className="eyebrow">VIDEO ANALYSIS</p>
            <h1>My swing videos</h1>
            <p>Upload footage, follow processing and see when a swing is ready for coach review.</p>
          </div>
          <Link className="primary-button" href="/player/videos/upload">Upload a swing</Link>
        </header>
        {loading ? (
          <section className="empty-state"><p>Loading your videos…</p></section>
        ) : error ? (
          <section className="empty-state"><h2>Videos unavailable</h2><p>{error}</p></section>
        ) : !videos.length ? (
          <section className="empty-state"><h2>No swing videos yet</h2><p>Upload face-on or down-the-line footage to request an analysis.</p></section>
        ) : (
          <section className="video-grid">
            {videos.map((video) => (
              <article className="video-card" key={video.id}>
                <VideoStatusBadge status={video.status} />
                <h2>{video.club} · {video.swing_type.replaceAll('_', ' ')}</h2>
                <p>{video.camera_view.replaceAll('_', ' ')}</p>
                <small>{new Date(video.created_at).toLocaleDateString('en-GB')}</small>
                {video.player_question && <p>{video.player_question}</p>}
              </article>
            ))}
          </section>
        )}
      </main>
    </AuthGate>
  );
}
