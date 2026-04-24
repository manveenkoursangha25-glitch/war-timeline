'use client';

import dynamic from 'next/dynamic';

const GlobeClient = dynamic(() => import('./globe-client'), {
  ssr: false,
  loading: () => (
    <div className="loading-screen">
      <div className="loading-spinner"></div>
      <div style={{ marginTop: '20px', color: '#888' }}>Loading 3D Globe...</div>
    </div>
  ),
});

export default function Home() {
  return <GlobeClient />;
}
