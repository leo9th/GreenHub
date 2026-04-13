type Props = {
  loadingUp: boolean;
  loadingDown: boolean;
  loadingLeft: boolean;
  loadingRight: boolean;
  labelUp?: string;
  labelDown?: string;
};

export function InfiniteScrollIndicators({
  loadingUp,
  loadingDown,
  loadingLeft,
  loadingRight,
  labelUp = "Loading previous…",
  labelDown = "Loading more…",
}: Props) {
  return (
    <>
      {loadingUp ? (
        <div className="gh-scroll-indicator gh-scroll-indicator--top" role="status" aria-live="polite">
          <span className="gh-radium-spin" aria-hidden />
          <span>{labelUp}</span>
        </div>
      ) : null}
      {loadingDown ? (
        <div className="gh-scroll-indicator gh-scroll-indicator--bottom" role="status" aria-live="polite">
          <span className="gh-radium-spin" aria-hidden />
          <span>{labelDown}</span>
        </div>
      ) : null}
      {loadingLeft ? (
        <div className="gh-scroll-indicator gh-scroll-indicator--left" role="status" aria-live="polite">
          <span className="gh-radium-spin" aria-hidden />
          <span>←</span>
        </div>
      ) : null}
      {loadingRight ? (
        <div className="gh-scroll-indicator gh-scroll-indicator--right" role="status" aria-live="polite">
          <span className="gh-radium-spin" aria-hidden />
          <span>→</span>
        </div>
      ) : null}
    </>
  );
}
