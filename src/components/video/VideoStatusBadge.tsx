const labels: Record<string, string> = { waiting_for_upload:'Waiting', uploading:'Uploading', processing:'Processing', ready:'Ready for review', error:'Needs attention', cancelled:'Cancelled', archived:'Archived' };
export function VideoStatusBadge({ status }: { status: string }) { return <span className={`video-status video-status--${status}`}>{labels[status] ?? status}</span>; }
