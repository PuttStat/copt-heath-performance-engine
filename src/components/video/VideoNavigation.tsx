import Link from 'next/link';

export function VideoNavigation({ coach = false }: { coach?: boolean }) {
  return <nav aria-label="Video navigation" style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 24 }}>
    <Link href="/">← Dashboard</Link>
    <Link href="/player/videos">My videos</Link>
    <Link href="/player/videos/upload">Upload a swing</Link>
    {coach && <Link href="/coach/video-reviews">Video reviews</Link>}
  </nav>;
}
