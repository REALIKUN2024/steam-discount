export default function SkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col border border-edge bg-panel"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div className="shimmer aspect-[16/9] border-b border-edge bg-panel-2" />
          <div className="flex flex-1 flex-col gap-2 p-4">
            <div className="shimmer h-4 w-3/4 bg-panel-2" />
            <div className="shimmer h-3 w-full bg-panel-2" />
            <div className="shimmer h-3 w-5/6 bg-panel-2" />
            <div className="mt-auto flex gap-1.5 pt-2">
              <div className="shimmer h-5 w-14 bg-panel-2" />
              <div className="shimmer h-5 w-14 bg-panel-2" />
              <div className="shimmer h-5 w-14 bg-panel-2" />
            </div>
            <div className="shimmer mt-2 h-8 w-full bg-panel-2" />
          </div>
        </div>
      ))}
    </div>
  );
}
