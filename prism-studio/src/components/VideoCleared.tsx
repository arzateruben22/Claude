// Shown instead of an episode's player and video downloads once the worker erased its .mp4 files from the server after
// it was posted everywhere (src/domain/media-cleanup.ts). The cover, thumbnail and captions stay available.
export const VIDEO_CLEARED = "Video cleared from Prism storage after posting (original kept in GitHub)";

export function VideoCleared() {
  return <p className="cleared-note" role="note">{VIDEO_CLEARED}</p>;
}
