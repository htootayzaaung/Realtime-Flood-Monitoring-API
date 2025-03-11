import React, { useEffect, useState, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import annotationPlugin from 'chartjs-plugin-annotation';
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
    TimeScale,
    annotationPlugin
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

    const todayStart = new Date().setHours(0, 0, 0, 0);
    const yesterdayReadings = readings.filter(r => new Date(r.dateTime) < todayStart);
    const todayReadings = readings.filter(r => new Date(r.dateTime) >= todayStart);
    
    // Then replace your existing chartData definition with this:
    const chartData = {
      datasets: [
        {
          label: `Yesterday's ${parameterName} (${unitName})`,
          data: yesterdayReadings.map(reading => ({
            x: new Date(reading.dateTime),
            y: reading.value
          })),
          fill: false,
          backgroundColor: 'rgb(153, 204, 255)', // Lighter blue for yesterday
          borderColor: 'rgba(153, 204, 255, 0.8)',
          tension: 0.1,
          pointRadius: 3,
        },
        {
          label: `Today's ${parameterName} (${unitName})`,
          data: todayReadings.map(reading => ({
            x: new Date(reading.dateTime),
            y: reading.value
          })),
          fill: false,
          backgroundColor: 'rgb(75, 192, 192)', // Current blue for today
          borderColor: 'rgba(75, 192, 192, 0.8)',
          tension: 0.1,
          pointRadius: 3,
        }
      ],
    };
    
    // You'll need to modify your "highlight the most recent reading" code as well:
    if (readings.length > 0) {
      const lastReading = readings[readings.length - 1];
      // Determine which dataset the most recent reading belongs to
      const datasetIndex = new Date(lastReading.dateTime) >= todayStart ? 1 : 0;
      const dataIndex = datasetIndex === 1 
        ? todayReadings.length - 1 
        : yesterdayReadings.length - 1;
      
      chartData.datasets[datasetIndex].pointBackgroundColor = 
        chartData.datasets[datasetIndex].data.map((_, index) => 
          index === dataIndex ? 'red' : chartData.datasets[datasetIndex].backgroundColor
        );
      
      chartData.datasets[datasetIndex].pointRadius = 
        chartData.datasets[datasetIndex].data.map((_, index) => 
          index === dataIndex ? 5 : 3
        );
    }

  // Chart options
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
        text: ['24 Hour Readings', readings.length > 0 ? 
          `From ${new Date(readings[0]?.dateTime).toLocaleDateString()} to ${new Date(readings[readings.length-1]?.dateTime).toLocaleDateString()}` : 
          ''],
        font: {
          size: 16
        }
      },
      tooltip: {
        callbacks: {
          title: (context) => {
            const date = new Date(context[0].parsed.x);
            return date.toLocaleString();
          },
          label: (context) => {
            const isLastPoint = context.dataIndex === readings.length - 1;
            const label = `${parameterName}: ${context.parsed.y} ${unitName}`;
            return isLastPoint ? `${label} (Most Recent)` : label;
          }
        }
      },
      // The annotation property should be inside the plugins object
      annotation: {
        annotations: {
          midnight: {
            type: 'line',
            xMin: new Date().setHours(0, 0, 0, 0),
            xMax: new Date().setHours(0, 0, 0, 0),
            borderColor: 'rgba(255, 0, 0, 0.5)',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              content: 'Midnight',
              enabled: true,
              position: 'top'
            }
          }
        }
      }
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'hour',
          stepSize: 3,
          displayFormats: {
            hour: 'MMM d, HH:mm' 
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
            top: '10px',  // Changed from bottom to top
            right: '20px',
            backgroundColor: 'rgba(255,255,255,0.7)',
            padding: '5px',
            borderRadius: '5px',
            boxShadow: '0 0 5px rgba(0,0,0,0.2)',
            zIndex: 10  // Added z-index to ensure it appears above the chart
        }}>
            <span style={{ color: 'red', fontWeight: 'bold', marginRight: '5px' }}>●</span>
            Most Recent Reading  {/* Changed text from "Current Reading" */}
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