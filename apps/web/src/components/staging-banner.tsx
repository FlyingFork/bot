export function StagingBanner() {
  if (process.env.NEXT_PUBLIC_APP_ENV !== "staging") return null;

  return (
    <div className="w-full bg-amber-500 py-1.5 text-center text-xs font-semibold tracking-widest text-black uppercase">
      Staging Environment / Тестовая Среда
    </div>
  );
}
