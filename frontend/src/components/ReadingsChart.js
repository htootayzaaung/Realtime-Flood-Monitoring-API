import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { getStationReadings } from '../services/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const ReadingsChart = ({ stationId }) => {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReadings = async () => {
      if (!stationId) return;
      
      try {
        setLoading(true);
        const data = await getStationReadings(stationId, { _sorted: true });
        setReadings(data.items || []);
      } catch (err) {
        setError('Failed to load readings');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchReadings();
  }, [stationId]);

  if (!stationId) return <div>Select a station to view readings</div>;
  if (loading) return <div>Loading readings...</div>;
  if (error) return <div>Error: {error}</div>;
  if (readings.length === 0) return <div>No readings available for this station</div>;

  // Prepare chart data
  const chartData = {
    labels: readings.map(reading => {
      const date = new Date(reading.dateTime);
      return date.toLocaleTimeString();
    }),
    datasets: [
      {
        label: 'Reading Value',
        data: readings.map(reading => reading.value),
        fill: false,
        backgroundColor: 'rgb(75, 192, 192)',
        borderColor: 'rgba(75, 192, 192, 0.2)',
      },
    ],
  };

  // Chart options
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: '24 Hour Readings',
      },
    },
    scales: {
      y: {
        beginAtZero: false,
      },
    },
  };

  return (
    <div>
      <Line data={chartData} options={options} />
      <h3>Readings Table</h3>
      <table className="readings-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Value</th>
            <th>Parameter</th>
          </tr>
        </thead>
        <tbody>
          {readings.map((reading, index) => (
            <tr key={index}>
              <td>{new Date(reading.dateTime).toLocaleString()}</td>
              <td>{reading.value}</td>
              <td>{reading.measure?.parameterName || 'Unknown'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ReadingsChart;