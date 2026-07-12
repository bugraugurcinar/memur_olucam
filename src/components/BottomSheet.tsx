import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { animate, motion, useDragControls, useMotionValue, type PanInfo } from "framer-motion";

export type SheetSnap = "peek" | "half" | "full";

const SNAP_SPRING = { type: "spring", stiffness: 420, damping: 40 } as const;

export type BottomSheetProps = {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  /** peek konumunda görünür kalan yükseklik (px). */
  peekHeight?: number;
  /** half konumunda sheet yüksekliğinin görünür oranı (0-1). */
  halfRatio?: number;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
};

/**
 * Tutamaçtan sürüklenen, peek/half/full konumlarına yaslanan alt sayfa.
 * Sürükleme YALNIZCA tutamaçtan başlar; gövde kaydırması sheet'i oynatmaz.
 * Konumlandırma transform (y) ile yapılır — peek durumunda sheet'in üstünde
 * kalan alan dokunuşları alttaki haritaya geçirir.
 */
export function BottomSheet({
  snap,
  onSnapChange,
  peekHeight = 92,
  halfRatio = 0.55,
  className,
  ariaLabel,
  children,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  // İlk boyamada ekranın altından süzülerek gelsin.
  const y = useMotionValue(typeof window !== "undefined" ? window.innerHeight : 0);
  const dragControls = useDragControls();

  const offsets = useMemo(
    () => ({
      full: 0,
      half: Math.max(0, Math.round(sheetHeight * (1 - halfRatio))),
      peek: Math.max(0, sheetHeight - peekHeight),
    }),
    [halfRatio, peekHeight, sheetHeight],
  );

  useLayoutEffect(() => {
    const node = sheetRef.current;
    if (!node) {
      return;
    }
    const measure = () => setSheetHeight(node.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (sheetHeight === 0) {
      return;
    }
    // Gövde yüksekliği görünür alanla sınırlanır (--sheet-hidden, CSS'te
    // kullanılır); yoksa half/peek konumunda içeriğin alt kısmı ekranın
    // altına taşar ve kaydırarak da erişilemez olur.
    sheetRef.current?.style.setProperty("--sheet-hidden", `${offsets[snap]}px`);
    const controls = animate(y, offsets[snap], SNAP_SPRING);
    return () => controls.stop();
  }, [offsets, sheetHeight, snap, y]);

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    // Kısa dokunuş: sürükleme değil, tutamaç tıklaması → bir üst konuma geç.
    if (Math.abs(info.offset.y) < 8) {
      onSnapChange(snap === "peek" ? "half" : snap === "half" ? "full" : "half");
      return;
    }

    // Hız projeksiyonu: fiske (flick) bir sonraki snap'e atlasın.
    const projected = y.get() + info.velocity.y * 0.15;
    let best: SheetSnap = "half";
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const key of ["peek", "half", "full"] as const) {
      const distance = Math.abs(projected - offsets[key]);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = key;
      }
    }

    if (best === snap) {
      // Snap değişmeyince useEffect tetiklenmez; elle geri yaslan.
      animate(y, offsets[best], SNAP_SPRING);
    } else {
      onSnapChange(best);
    }
  };

  return (
    <motion.div
      ref={sheetRef}
      className={`sheet${className ? ` ${className}` : ""}`}
      style={{ y }}
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: offsets.peek }}
      dragElastic={0.06}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      role="dialog"
      aria-label={ariaLabel}
    >
      <div
        className="sheet__handle"
        onPointerDown={(event) => dragControls.start(event)}
        aria-hidden="true"
      >
        <span className="sheet__grip" />
      </div>
      <div className="sheet__body">{children}</div>
    </motion.div>
  );
}
