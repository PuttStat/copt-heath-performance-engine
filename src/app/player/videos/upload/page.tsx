import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VideoUploadForm } from '@/components/video/VideoUploadForm';

export default async function UploadSwingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <main className="video-page video-page--narrow"><p className="eyebrow">VIDEO ANALYSIS</p><h1>Upload a swing</h1><p>Use the original phone video where possible. A clear face-on or down-the-line view gives your coach the strongest evidence.</p><VideoUploadForm /></main>;
}
