import { NowPlayingPanel } from '../NowPlayingPanel.jsx';

export const PlaybackPanel = ({ formatError, onAuthExpired, provider }) => {
  return (
    <section className="min-w-0">
      <NowPlayingPanel
        provider={provider}
        formatError={formatError}
        onAuthExpired={onAuthExpired}
        variant="player"
      />
    </section>
  );
};
