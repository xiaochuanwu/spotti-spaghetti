import { NowPlayingPanel } from '../NowPlayingPanel.jsx';

export const PlaybackPanel = ({ playback }) => {
  return (
    <section className="min-w-0">
      <NowPlayingPanel
        playback={playback}
        variant="player"
      />
    </section>
  );
};
