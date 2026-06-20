import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { getBadgeById, type GamificationEvents } from "../quiz/gamification";

export type FxItem =
  | { id: number; kind: "xp"; amount: number }
  | { id: number; kind: "levelup"; level: number }
  | { id: number; kind: "badge"; badgeId: string }
  | { id: number; kind: "quest"; label: string; xp: number };

const DURATIONS: Record<FxItem["kind"], number> = {
  xp: 1200,
  levelup: 2800,
  badge: 3200,
  quest: 3200,
};

let fxIdCounter = 0;

/** GamificationEvents → animasyon kuyruğu öğeleri. */
export function buildFxItems(events: GamificationEvents): FxItem[] {
  const items: FxItem[] = [];
  if (events.xpGained > 0) {
    fxIdCounter += 1;
    items.push({ id: fxIdCounter, kind: "xp", amount: events.xpGained });
  }
  if (events.leveledUp) {
    fxIdCounter += 1;
    items.push({ id: fxIdCounter, kind: "levelup", level: events.leveledUp.to });
  }
  for (const badgeId of events.unlockedBadges) {
    fxIdCounter += 1;
    items.push({ id: fxIdCounter, kind: "badge", badgeId });
  }
  for (const quest of events.completedQuests) {
    fxIdCounter += 1;
    items.push({ id: fxIdCounter, kind: "quest", label: quest.label, xp: quest.xpReward });
  }
  return items;
}

function FxEntry({ item, onDismiss }: { item: FxItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(item.id), DURATIONS[item.kind]);
    const palette = ["#34d399", "#10b981", "#fde047", "#facc15", "#e7f1ea"];
    if (item.kind === "levelup") {
      confetti({ particleCount: 150, spread: 85, startVelocity: 45, origin: { y: 0.6 }, colors: palette });
    } else if (item.kind === "badge") {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.35 }, colors: palette });
    }
    return () => window.clearTimeout(timer);
  }, [item, onDismiss]);

  if (item.kind === "xp") {
    return (
      <motion.div
        className="fx-xp"
        initial={{ opacity: 0, y: 12, scale: 0.8 }}
        animate={{ opacity: 1, y: -34, scale: 1 }}
        exit={{ opacity: 0, y: -64 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      >
        +{item.amount} XP
      </motion.div>
    );
  }

  if (item.kind === "levelup") {
    return (
      <motion.div
        className="fx-levelup"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
      >
        <span className="fx-levelup__badge">{item.level}</span>
        <strong>Seviye {item.level}!</strong>
        <small>Yeni seviyeye ulaştın 🎉</small>
      </motion.div>
    );
  }

  if (item.kind === "badge") {
    const badge = getBadgeById(item.badgeId);
    return (
      <motion.div
        className="fx-toast fx-toast--badge"
        initial={{ opacity: 0, x: 48 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 48 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      >
        <span className="fx-toast__icon">{badge?.icon ?? "🏅"}</span>
        <div>
          <strong>Rozet açıldı</strong>
          <small>{badge?.label ?? item.badgeId}</small>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="fx-toast fx-toast--quest"
      initial={{ opacity: 0, x: 48 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 48 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      <span className="fx-toast__icon">✅</span>
      <div>
        <strong>Görev tamamlandı</strong>
        <small>
          {item.label} · +{item.xp} XP
        </small>
      </div>
    </motion.div>
  );
}

export function GamificationFX({
  items,
  onDismiss,
}: {
  items: FxItem[];
  onDismiss: (id: number) => void;
}) {
  const centerItems = items.filter((item) => item.kind === "levelup" || item.kind === "xp");
  const toastItems = items.filter((item) => item.kind === "badge" || item.kind === "quest");

  return (
    <>
      <div className="fx-center" aria-live="polite">
        <AnimatePresence>
          {centerItems.map((item) => (
            <FxEntry item={item} key={item.id} onDismiss={onDismiss} />
          ))}
        </AnimatePresence>
      </div>
      <div className="fx-toasts" aria-live="polite">
        <AnimatePresence>
          {toastItems.map((item) => (
            <FxEntry item={item} key={item.id} onDismiss={onDismiss} />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
