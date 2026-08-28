import { AuthGate } from "@/app/ui/auth-gate";
import { AnalysisWorkspace } from "@/src/components/video/AnalysisWorkspace";
import "@/src/styles/package-7i2.css";
export default async function SwingAnalysisPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  return (
    <AuthGate>
      <AnalysisWorkspace key={videoId} videoId={videoId} />
    </AuthGate>
  );
}
