// Runs `fn` now, then every `ms` while the page is visible. A hidden tab (phone in a pocket,
// background browser tab) stops polling Sleeper/ESPN; coming back refreshes once and resumes.
// Returns a cleanup function for use inside a useEffect.
export function startPolling(fn, ms) {
  let intervalId = null;
  const isVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
  const start = () => {
    if (intervalId == null) intervalId = window.setInterval(fn, ms);
  };
  const stop = () => {
    if (intervalId != null) window.clearInterval(intervalId);
    intervalId = null;
  };
  const onVisibility = () => {
    if (isVisible()) {
      fn();
      start();
    } else {
      stop();
    }
  };
  fn();
  if (isVisible()) start();
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
