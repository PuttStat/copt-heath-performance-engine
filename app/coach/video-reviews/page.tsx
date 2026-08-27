'use client';

import { useEffect, useState } from 'react';
import { AuthGate } from '@/app/ui/auth-gate';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { VideoStatusBadge } from '@/src/components/video/VideoStatusBadge';

type ReviewVideo = {
  id: string;
  player_id: string;
  swing_type: string;
  camera_view: string;
  club: string;
  status: string;
  created_at: string;
  player_question: string | null;
  player_name: string;
};

export default function CoachVideoQueuePage() {
  const [videos, setVideos] = useState<ReviewVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError('Video review is not configured.');
      setLoading(false);
      return;
    }

    (async () => {
      const { data, error: queryError } = await supabase
        .from('swing_videos')
        .select('id,player_id,swing_type,camera_view,club,status,created_at,player_question')
        .in('status', ['processing', 'ready', 'error'])
        .order('review_requested_at', { ascending: true });

      if (queryError) {
        setError('The video review queue could not be loaded.');
        setLoading(false);
        return;
      }

      const rows = data ?? [];
      const playerIds = [...new Set(rows.map((video) => video.player_id))];
      const names = new Map<string, string>();
      if (playerIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id,display_name,email')
          .in('id', playerIds);
        for (const profile of profiles ?? []) {
          names.set(profile.id, profile.display_name || profile.email || 'Player');
        }
      }

      setVideos(rows.map((video) => ({
        ...video,
        player_name: names.get(video.player_id) ?? 'Player',
      })) as ReviewVideo[]);
      setLoading(false);
    })();
  }, []);

  return (
    <AuthGate>
      <main className="video-page">
        <header>
          <div>
            <p className="eyebrow">COACH WORKSPACE</p>
            <h1>Video review queue</h1>
            <p>Player uploads appear here after secure processing.</p>
          </div>
        </header>
        {loading ? (
          <section className="empty-state"><p>Loading the review queue…</p></section>
        ) : error ? (
          <section className="empty-state"><h2>Queue unavailable</h2><p>{error}</p></section>
        ) : !videos.length ? (
          <section className="empty-state"><h2>No videos waiting</h2><p>New linked-player uploads will appear automatically.</p></section>
        ) : (
          <div className="review-list">
            {videos.map((video) => (
              <article className="review-row" key={video.id}>
                <div>
                  <VideoStatusBadge status={video.status} />
                  <h2>{video.player_name} · {video.club}</h2>
                  <p>{video.swing_type.replaceAll('_', ' ')} · {video.camera_view.replaceAll('_', ' ')}</p>
                  {video.player_question && <blockquote>{video.player_question}</blockquote>}
                </div>
                <time>{new Date(video.created_at).toLocaleDateString('en-GB')}</time>
              </article>
            ))}
          </div>
        )}
      </main>
    </AuthGate>
  );
}
