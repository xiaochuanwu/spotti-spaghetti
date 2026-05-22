import { NowPlayingPanel } from '../NowPlayingPanel.jsx';

export const PlaybackPanel = ({ formatError, provider }) => {
  return (
    <section className="min-w-0">
      <NowPlayingPanel provider={provider} formatError={formatError} variant="player" />
    </section>
  );
};
