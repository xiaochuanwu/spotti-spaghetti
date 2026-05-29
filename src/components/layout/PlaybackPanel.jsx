import { NowPlayingPanel } from '../NowPlayingPanel.jsx';

export const PlaybackPanel = ({
  playback,
  playbackActions,
  playbackQueue,
  trackLibrary,
}) => (
  <section className="min-w-0 lg:min-h-[664px]">
    <NowPlayingPanel
      playback={playback}
      playbackActions={playbackActions}
      playbackQueue={playbackQueue}
      trackLibrary={trackLibrary}
      variant="player"
    />
  </section>
);
