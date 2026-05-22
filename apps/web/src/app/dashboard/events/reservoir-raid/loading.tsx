import { Skeleton } from "@/components/ui/skeleton";

export default function ReservoirRaidLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <div className="flex items-center justify-between gap-3 md:justify-end">
        <Skeleton className="h-8 w-36 md:hidden" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]">
        <Skeleton className="hidden aspect-[1280/739] min-h-80 md:block" />
        <div className="flex flex-col gap-3 md:hidden">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="hidden min-h-[28rem] md:block" />
      </div>
    </div>
  );
}
