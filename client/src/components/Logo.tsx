export function Logo() {
  return (
    <div className="flex items-center gap-4">
      <img src="/logo-light.png" alt="PERFO Formation Industrielle" className="h-10 w-auto object-contain" />
      <div className="hidden border-l border-white/15 pl-4 text-xs uppercase tracking-[0.24em] text-slate-300 sm:block">
        Quiz live
      </div>
    </div>
  );
}
