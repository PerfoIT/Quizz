export function Fireworks() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 14 }, (_, index) => (
        <span key={index} className={`firework firework-${index + 1}`} />
      ))}
    </div>
  );
}
