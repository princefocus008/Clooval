import React from 'react';
import Skeleton from './Skeleton';

export default function AdminOverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="rounded-2xl border border-[#E5E5E3] bg-white p-4">
            <Skeleton width="80px" height="12px" />
            <Skeleton width="60px" height="28px" className="mt-3" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-[#E5E5E3] bg-white p-4">
        <Skeleton width="140px" height="14px" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} width="100%" height="44px" />
          ))}
        </div>
      </div>
    </div>
  );
}
