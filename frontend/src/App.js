import React, { useState } from 'react';
import './App.css';
import StationMap from './components/StationMap';
import ReadingsChart from './components/ReadingsChart';

function App() {
  const [selectedStation, setSelectedStation] = useState(null);

  const handleStationSelect = (station) => {
    setSelectedStation(station);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Realtime Flood Monitoring</h1>
        <p>Select a station on the map to view its readings</p>
      </header>
      <main>
        <div className="container">
          <div className="map-container">
            <h2>Monitoring Stations</h2>
            <StationMap onStationSelect={handleStationSelect} />
          </div>
          {selectedStation && (
            <div className="readings-container">
              <h2>Station: {selectedStation.label}</h2>
              <div className="station-info">
                <p><strong>River:</strong> {selectedStation.riverName || 'N/A'}</p>
                <p><strong>Town:</strong> {selectedStation.town || 'N/A'}</p>
              </div>
              <ReadingsChart stationId={selectedStation.stationReference} />
            </div>
          )}
        </div>
      </main>
      <footer>
        <p>
          This uses Environment Agency flood and river level data from the real-time data API (Beta)
        </p>
      </footer>
    </div>
  );
}

export default App;