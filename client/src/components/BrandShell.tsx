import type { PropsWithChildren } from "react";

export function BrandShell({ children }: PropsWithChildren) {
  return (
    <main className="min-h-screen overflow-hidden bg-perfo-ink text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(29,109,255,0.28),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(55,214,255,0.12),transparent_28%),linear-gradient(135deg,#030712,#07111F_52%,#020617)]" />
      <div className="fixed inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:64px_64px]" />
      <div className="relative z-10">{children}</div>
    </main>
  );
}

