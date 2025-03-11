import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import { getStations } from '../services/api';
import L from 'leaflet';

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const StationMap = ({ onStationSelect }) => {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStations = async () => {
      try {
        setLoading(true);
        const data = await getStations({ _limit: 1000 }); // Limit to 1000 stations for performance
        setStations(data.items || []);
      } catch (err) {
        setError('Failed to load stations');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStations();
  }, []);

  if (loading) return <div>Loading stations...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ height: '500px', width: '100%' }}>
      <MapContainer center={[52.4862, -1.8904]} zoom={7} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MarkerClusterGroup>
          {stations.map(station => {
            // Only include stations with latitude and longitude
            if (station.lat && station.long) {
              return (
                <Marker 
                  key={station.stationReference} 
                  position={[station.lat, station.long]}
                  eventHandlers={{
                    click: () => onStationSelect(station),
                  }}
                >
                  <Popup>
                    <div>
                      <h3>{station.label || 'Unnamed Station'}</h3>
                      <p>River: {station.riverName || 'Unknown'}</p>
                      <p>Type: {station.parameter || 'Unknown'}</p>
                      <button onClick={() => onStationSelect(station)}>
                        View Readings
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            }
            return null;
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
};

export default StationMap;