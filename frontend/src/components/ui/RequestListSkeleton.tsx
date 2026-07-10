import React from 'react';
import Skeleton from './Skeleton';

export default function RequestListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="flex items-center justify-between gap-4 border-b border-[#E5E5E3] pb-4">
          <div className="flex items-center gap-3">
            <Skeleton width="40px" height="40px" borderRadius="9999px" />
            <div className="space-y-2">
              <Skeleton width="180px" height="14px" />
              <Skeleton width="120px" height="12px" />
            </div>
          </div>
          <Skeleton width="80px" height="24px" borderRadius="9999px" />
        </div>
      ))}
    </div>
  );
}
