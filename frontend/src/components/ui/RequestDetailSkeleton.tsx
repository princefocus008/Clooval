import React from 'react';
import Skeleton from './Skeleton';

export default function RequestDetailSkeleton() {
  return (
    <div className="space-y-6 py-4 animate-slide-up">
      <div className="flex items-center gap-4">
        <Skeleton width="40px" height="40px" borderRadius="9999px" />
        <Skeleton width="160px" height="24px" />
      </div>
      <Skeleton width="100%" height="180px" />
      <Skeleton width="100%" height="140px" />
      <Skeleton width="100%" height="100px" />
    </div>
  );
}
