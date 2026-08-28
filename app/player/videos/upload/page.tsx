'use client';

import { AuthGate } from '@/app/ui/auth-gate';
import { VideoNavigation } from '@/src/components/video/VideoNavigation';
import { VideoUploadForm } from '@/src/components/video/VideoUploadForm';

export default function UploadSwingPage() {
  return (
    <AuthGate>
      <main className="video-page video-page--narrow">
        <VideoNavigation />
        <p className="eyebrow">VIDEO ANALYSIS</p>
        <h1>Upload a swing</h1>
        <p>
          Use the original phone video where possible. A clear face-on or
          down-the-line view gives your coach the strongest evidence.
        </p>
        <VideoUploadForm />
      </main>
    </AuthGate>
  );
}
