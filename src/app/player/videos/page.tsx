import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VideoStatusBadge } from '@/components/video/VideoStatusBadge';

export default async function PlayerVideosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: videos } = await supabase.from('swing_videos').select('id,swing_type,camera_view,club,status,created_at,player_question').eq('player_id', user.id).order('created_at', { ascending:false });
  return <main className="video-page"><header><div><p className="eyebrow">VIDEO ANALYSIS</p><h1>My swing videos</h1><p>Upload footage, follow processing and see when a swing is ready for coach review.</p></div><Link className="primary-button" href="/player/videos/upload">Upload a swing</Link></header>
    {!videos?.length ? <section className="empty-state"><h2>No swing videos yet</h2><p>Upload face-on or down-the-line footage to request an analysis.</p></section> : <section className="video-grid">{videos.map(v => <article className="video-card" key={v.id}><VideoStatusBadge status={v.status}/><h2>{v.club} · {v.swing_type.replaceAll('_',' ')}</h2><p>{v.camera_view.replaceAll('_',' ')}</p><small>{new Date(v.created_at).toLocaleDateString('en-GB')}</small>{v.player_question && <p>{v.player_question}</p>}</article>)}</section>}
  </main>;
}
