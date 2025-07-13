import React from 'react';
import AdvancedSatelliteTracker from './AdvancedSatelliteTracker';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <AdvancedSatelliteTracker />
    </ErrorBoundary>
  );
}

export default App;