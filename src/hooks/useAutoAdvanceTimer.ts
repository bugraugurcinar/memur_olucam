import { useEffect, useRef, useState } from "react";

// Bir soru cevaplandıktan sonra sabit bir süre bekleyip otomatik olarak
// bir sonraki soruya geçmek için kullanılır (hem test hem harita/Soru+ modu).
// Kalan süreyi ms cinsinden döner ki ilerleme çubuğu buna göre çizilsin.
export function useAutoAdvanceTimer(active: boolean, durationMs: number, onComplete: () => void): number {
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!active) {
      setRemainingMs(durationMs);
      return;
    }

    const startedAt = Date.now();
    setRemainingMs(durationMs);
    const interval = window.setInterval(() => {
      const left = durationMs - (Date.now() - startedAt);
      if (left <= 0) {
        window.clearInterval(interval);
        setRemainingMs(0);
        onCompleteRef.current();
      } else {
        setRemainingMs(left);
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [active, durationMs]);

  return remainingMs;
}
