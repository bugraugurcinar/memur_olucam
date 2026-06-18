type LayerStatusProps = {
  label: string;
  detail: string;
  isReady: boolean;
};

export function LayerStatus({ label, detail, isReady }: LayerStatusProps) {
  return (
    <div className="layer-status">
      <span className={isReady ? "layer-status__dot layer-status__dot--ready" : "layer-status__dot"} />
      <div>
        <span>{label}</span>
        <strong>{detail}</strong>
      </div>
    </div>
  );
}
