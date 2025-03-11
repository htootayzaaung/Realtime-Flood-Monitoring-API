import React, { useEffect, useState, useRef } from 'react';
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
  TimeScale,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { getStationReadings } from '../services/api';


ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale
  );

  const ReadingsChart = ({ stationId }) => {
    const [readings, setReadings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [unitName, setUnitName] = useState('Value');
    const [parameterName, setParameterName] = useState('Reading');
    const scrollContainerRef = useRef(null);
  
    useEffect(() => {
        const fetchReadings = async () => {
          if (!stationId) return;
          
          try {
            setLoading(true);
            const data = await getStationReadings(stationId, { _sorted: true });
            
            // Sort readings chronologically (oldest to newest)
            const sortedReadings = [...(data.items || [])].sort((a, b) => 
              new Date(a.dateTime) - new Date(b.dateTime)
            );
            
            setReadings(sortedReadings);
            
            // Add more detailed debugging here
            if (sortedReadings.length > 0) {
              console.log("First reading:", sortedReadings[0]);
              
              if (sortedReadings[0].measure) {
                console.log("Measure object:", JSON.stringify(sortedReadings[0].measure, null, 2));
                
                const measure = sortedReadings[0].measure;
                console.log("Unit name property:", measure.unitName);
                console.log("Parameter name properties:", {
                  parameterName: measure.parameterName,
                  parameter: measure.parameter
                });
                
                setUnitName(measure.unitName || 'Value');
                setParameterName(measure.parameterName || measure.parameter || 'Reading');
              } else {
                console.log("No measure object found in the reading");
              }
            }
          } catch (err) {
            setError('Failed to load readings');
            console.error(err);
          } finally {
            setLoading(false);
          }
        };
      
        fetchReadings();
      }, [stationId]);
  
  
    useEffect(() => {
        if (scrollContainerRef.current && readings.length > 0) {
          scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
        }
      }, [readings]);

    if (!stationId) return <div>Select a station to view readings</div>;
    if (loading) return <div>Loading readings...</div>;
    if (error) return <div>Error: {error}</div>;
    if (readings.length === 0) return <div>No readings available for this station</div>;

  // Prepare chart data
  const chartData = {
    datasets: [
      {
        label: `${parameterName} (${unitName})`,
        data: readings.map(reading => ({
          x: new Date(reading.dateTime),
          y: reading.value
        })),
        fill: false,
        backgroundColor: 'rgb(75, 192, 192)',
        borderColor: 'rgba(75, 192, 192, 0.8)',
        tension: 0.1,
        pointRadius: 3,
      },
    ],
  };

  // Highlight the most recent reading
  if (readings.length > 0) {
    const lastIndex = readings.length - 1;
    chartData.datasets[0].pointBackgroundColor = readings.map((_, index) => 
      index === lastIndex ? 'red' : 'rgb(75, 192, 192)'
    );
    chartData.datasets[0].pointRadius = readings.map((_, index) => 
      index === lastIndex ? 5 : 3
    );
  }

  // Chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: '24 Hour Readings'
      },
      tooltip: {
        callbacks: {
          title: (context) => {
            const date = new Date(context[0].parsed.x);
            return date.toLocaleString();
          },
          label: (context) => {
            return `${parameterName}: ${context.parsed.y} ${unitName}`;
          }
        }
      }
    },
    scales: {
        x: {
          type: 'time',
          time: {
            unit: 'hour',  // Changed from minute to hour for clearer labeling
            stepSize: 3,    // Show a label every 3 hours
            displayFormats: {
              hour: 'HH:mm'
            }
          },
          title: {
            display: true,
            text: 'Time'
          }
        },
        y: {
          title: {
            display: true,
            text: `${parameterName} (${unitName})`
            }
        }
    }
  };

  // Create a filtered dataset for table display (30-minute intervals)
  const filteredReadings = readings.filter((reading, index) => {
    // Keep first, last, and readings at 30-minute intervals
    if (index === 0 || index === readings.length - 1) return true;
    
    const readingDate = new Date(reading.dateTime);
    return readingDate.getMinutes() % 30 === 0;
  });

  return (
    <div>
      <div
        ref={scrollContainerRef}
        style={{
          height: '400px',
          overflowX: 'auto',
          position: 'relative',  // Added the missing comma here
          border: '1px solid #ddd'
        }}
      >
        <div style={{ minWidth: '1200px', height: '100%' }}>
          <Line data={chartData} options={options} />
        </div>
        <div style={{
          position: 'absolute',
          bottom: '10px',
          right: '20px',
          backgroundColor: 'rgba(255,255,255,0.7)',
          padding: '5px',
          borderRadius: '5px',
          boxShadow: '0 0 5px rgba(0,0,0,0.2)'
        }}>
          <span style={{ color: 'red', fontWeight: 'bold', marginRight: '5px' }}>●</span>
          Current Reading
        </div>
      </div>
      
      <h3>Readings Table (30min intervals)</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="readings-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>{parameterName}</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            {filteredReadings.map((reading, index) => (
              <tr key={index} className={index === filteredReadings.length - 1 ? 'current-reading' : ''}>
                <td>{new Date(reading.dateTime).toLocaleString()}</td>
                <td>{reading.value}</td>
                <td>{unitName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}; 

export default ReadingsChart;