import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VideoStatusBadge } from '@/src/components/video/VideoStatusBadge';

export default async function CoachVideoQueuePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: videos } = await supabase.from('swing_videos').select('id,player_id,swing_type,camera_view,club,status,created_at,player_question,profiles!swing_videos_player_id_fkey(full_name)').in('status',['processing','ready','error']).order('review_requested_at',{ascending:true});
  return <main className="video-page"><header><div><p className="eyebrow">COACH WORKSPACE</p><h1>Video review queue</h1><p>Player uploads appear here after secure processing.</p></div></header>
    {!videos?.length ? <section className="empty-state"><h2>No videos waiting</h2><p>New linked-player uploads will appear automatically.</p></section> : <div className="review-list">{videos.map((v:any)=><article className="review-row" key={v.id}><div><VideoStatusBadge status={v.status}/><h2>{v.profiles?.full_name ?? 'Player'} · {v.club}</h2><p>{v.swing_type.replaceAll('_',' ')} · {v.camera_view.replaceAll('_',' ')}</p>{v.player_question && <blockquote>{v.player_question}</blockquote>}</div><time>{new Date(v.created_at).toLocaleDateString('en-GB')}</time></article>)}</div>}
  </main>;
}
