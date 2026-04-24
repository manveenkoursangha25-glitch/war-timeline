'use client';

import dynamic from 'next/dynamic';

// This is the key fix: dynamic import with `ssr: false`
const GlobeClient = dynamic(
  () => import('./globe-client').then((mod) => mod.default),
  {
    ssr: false, // This prevents server-side rendering of the globe
    loading: () => (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <div style={{ marginTop: 20, color: '#888' }}>Loading 3D Globe...</div>
      </div>
    ),
  }
);

export default function Home() {
  return <GlobeClient />;
}
