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
import TimeRangeSelector from './TimeRangeSelector';

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

  // New state variables for time range selection
  const [selectedRange, setSelectedRange] = useState('24h');
  const [customDateRange, setCustomDateRange] = useState(null);
  const [aggregationLevel, setAggregationLevel] = useState('none'); // none, hourly, daily
  const [chartTitle, setChartTitle] = useState('24 Hour Readings');

  // New state for selected detail view range (for the overview+detail system)
  const [detailViewRange, setDetailViewRange] = useState({
    start: null, 
    end: null
  });

  // Helper function to estimate position percentage
  const getPositionPercentage = (date, readings) => {
    if (!readings.length) return 0;
    
    const startTime = new Date(readings[0].dateTime).getTime();
    const endTime = new Date(readings[readings.length - 1].dateTime).getTime();
    const targetTime = new Date(date).getTime();
    
    // Calculate position as percentage
    return Math.max(0, Math.min(100, ((targetTime - startTime) / (endTime - startTime)) * 100));
  };

  // Helper function to calculate width percentage for detail range
  const getDetailRangeWidthPercentage = (range, readings) => {
    if (!readings.length) return 100;
    
    const totalDuration = new Date(readings[readings.length - 1].dateTime).getTime() - 
                          new Date(readings[0].dateTime).getTime();
    const rangeDuration = new Date(range.end).getTime() - new Date(range.start).getTime();
    
    return Math.max(5, Math.min(100, (rangeDuration / totalDuration) * 100));
  };
  
  // Calculate time range based on selected option
  const getTimeRange = () => {
    const now = new Date();
    let since = new Date();
    
    switch(selectedRange) {
      case '24h':
        since.setHours(since.getHours() - 24);
        return { since, now, title: '24 Hour Readings' };
      case '48h':
        since.setHours(since.getHours() - 48);
        return { since, now, title: '48 Hour Readings' };
      case 'week':
        since.setDate(since.getDate() - 7);
        setAggregationLevel('hourly');
        return { since, now, title: 'Last 7 Days' };
      case 'month':
        since.setMonth(since.getMonth() - 1);
        setAggregationLevel('daily');
        return { since, now, title: 'Last Month' };
      case 'custom':
        if (customDateRange) {
          // Determine aggregation level based on date range span
          const daysDiff = (customDateRange.end - customDateRange.start) / (1000 * 60 * 60 * 24);
          if (daysDiff > 14) {
            setAggregationLevel('daily');
          } else if (daysDiff > 3) {
            setAggregationLevel('hourly');
          } else {
            setAggregationLevel('none');
          }
          
          const formattedStart = customDateRange.start.toLocaleDateString();
          const formattedEnd = customDateRange.end.toLocaleDateString();
          return { 
            since: customDateRange.start, 
            now: customDateRange.end,
            title: `Custom Range (${formattedStart} to ${formattedEnd})`
          };
        }
        // Fall back to 24h if no custom range is set
        since.setHours(since.getHours() - 24);
        return { since, now, title: '24 Hour Readings' };
      default:
        since.setHours(since.getHours() - 24);
        return { since, now, title: '24 Hour Readings' };
    }
  };

  // Fetch readings based on the selected time range
  useEffect(() => {
    const fetchReadings = async () => {
      if (!stationId) return;
      
      try {
        setLoading(true);
        
        const { since, now, title } = getTimeRange();
        setChartTitle(title);
        
        // Format the since date for the API request
        const sinceStr = since.toISOString();
        
        // Request more data points for longer time ranges
        const limit = selectedRange === 'month' ? 5000 : 2000;
        
        const data = await getStationReadings(stationId, { 
          _sorted: true,
          since: sinceStr,
          _limit: limit
        });
        
        // Sort readings chronologically
        const sortedReadings = [...(data.items || [])].sort((a, b) => 
          new Date(a.dateTime) - new Date(b.dateTime)
        );
        
        // Extract unit information from the measure URL
        if (sortedReadings.length > 0) {
          console.log("First reading:", sortedReadings[0]);
          
          // Extract unit information
          const { unitName, parameterName } = extractUnitInfo(sortedReadings[0]);
          
          setUnitName(unitName);
          setParameterName(parameterName);
        } else {
          console.log("No readings found");
        }
        
        // Apply data aggregation based on the time range
        let processedReadings = sortedReadings;
        if (aggregationLevel !== 'none') {
          processedReadings = aggregateReadings(sortedReadings, aggregationLevel);
        }
        setReadings(processedReadings);
        
        // Set initial detail view range to include most recent day
        const totalTimespan = now - since;
        const detailSpan = Math.min(totalTimespan, 24 * 60 * 60 * 1000); // Show max 24h or whole range
        setDetailViewRange({
          start: new Date(now.getTime() - detailSpan),
          end: now
        });
        
      } catch (err) {
        setError('Failed to load readings');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchReadings();
  }, [stationId, selectedRange, customDateRange]);

  // Add this utility function to extract unit information consistently
  const extractUnitInfo = (reading) => {
    // Default values
    let unitName = 'Value';
    let parameterName = 'Reading';
    
    if (reading && reading.measure) {
      let measureInfo = reading.measure;
      console.log("FULL MEASURE OBJECT:", measureInfo);
      
      // First try to get values directly from properties
      if (typeof measureInfo === 'object') {
        unitName = measureInfo.unitName || unitName;
        parameterName = measureInfo.parameterName || measureInfo.parameter || parameterName;
      }
      
      // If still using default, try to extract from URL
      if (unitName === 'Value') {
        // Get the measure URL string
        const measureUrl = typeof measureInfo === 'string' ? 
          measureInfo : (measureInfo['@id'] || measureInfo.id || measureInfo);
        
        // Convert to string in case it's just the URL
        const measureUrlStr = String(measureUrl);
        console.log("Measure URL for extraction:", measureUrlStr);
        
        // Extract unit from the end of the URL
        const unitMatch = measureUrlStr.match(/-([a-zA-Z0-9\/]+)$/);
        if (unitMatch && unitMatch[1]) {
          const extractedCode = unitMatch[1];
          console.log("Extracted unit from URL:", extractedCode);
          
          // Map common unit codes to full descriptions
          const unitMap = {
            'm': 'meters',
            'mASD': 'meters Above Station Datum (mASD)',
            'mAOD': 'meters Above Ordnance Datum (mAOD)',
            'm3/s': 'cubic meters per second'
          };
          
          unitName = unitMap[extractedCode] || extractedCode;
        }
      }
      
      // If parameterName is still the default, try to extract from URL
      if (parameterName === 'Reading') {
        const measureUrl = typeof measureInfo === 'string' ? 
          measureInfo : (measureInfo['@id'] || measureInfo.id || measureInfo);
        
        const measureUrlStr = String(measureUrl);
        
        // Extract parameter from URL
        let extractedParameter = 'Water Level';
        const paramMatch = measureUrlStr.match(/\/measures\/\d+-([a-zA-Z]+)/);
        if (paramMatch && paramMatch[1]) {
          extractedParameter = paramMatch[1].charAt(0).toUpperCase() + paramMatch[1].slice(1);
          console.log("Extracted parameter from URL:", extractedParameter);
          parameterName = extractedParameter;
        }
      }
    }
    
    return { unitName, parameterName };
  };

  // Function to aggregate readings by hour or day
  const aggregateReadings = (readings, level) => {
    if (readings.length === 0) return [];
    
    // Group readings by the desired time interval
    const groups = {};
    
    readings.forEach(reading => {
      const date = new Date(reading.dateTime);
      let key;
      
      if (level === 'hourly') {
        // Group by hour: YYYY-MM-DD-HH
        // Add 1 to month and use padStart for consistent formatting
        key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}`;
      } else {
        // Group by day: YYYY-MM-DD
        key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }
      
      if (!groups[key]) {
        groups[key] = [];
      }
      
      groups[key].push(reading);
    });
    
    // Rest of the function remains the same
    return Object.keys(groups).map(key => {
      const group = groups[key];
      const sum = group.reduce((acc, reading) => acc + reading.value, 0);
      const avg = sum / group.length;
      
      // Use the timestamp of the middle reading in the group
      const midIndex = Math.floor(group.length / 2);
      
      return {
        ...group[midIndex],
        value: avg,
        // Keep track of original readings for potential detailed view
        originalReadings: group
      };
    }).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
  };
  
  // Handle time range selection changes
  const handleRangeChange = (range) => {
    setSelectedRange(range);
  };
  
  // Handle custom date range selection
  const handleCustomRangeChange = (start, end) => {
    setCustomDateRange({ start, end });
    setSelectedRange('custom');
  };
  
  // Handle detail view range selection from overview chart
  const handleDetailRangeChange = (start, end) => {
    setDetailViewRange({ start, end });
  };

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

  // Determine the 24-hour threshold (for highlighting recent data)
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
  
  // Split readings into before and after 24h threshold for coloring
  const olderReadings = readings.filter(r => new Date(r.dateTime) < twentyFourHoursAgo);
  const recentReadings = readings.filter(r => new Date(r.dateTime) >= twentyFourHoursAgo);

  // Filter readings for the detail view
  const detailReadings = readings.filter(r => {
    const time = new Date(r.dateTime);
    return time >= detailViewRange.start && time <= detailViewRange.end;
  });
  
  // Prepare data for overview chart (all readings)
  const overviewChartData = {
    datasets: [
      {
        label: `${parameterName} (${unitName})`,
        data: readings.map(reading => ({
          x: new Date(reading.dateTime),
          y: reading.value
        })),
        fill: false,
        borderColor: 'rgba(75, 192, 192, 0.8)',
        tension: 0.1,
        pointRadius: 0, // No points in overview chart for cleaner look
      }
    ]
  };

  // Prepare data for detail chart (selected range)
  const detailChartData = {
    datasets: [
      {
        label: `Older ${parameterName} (${unitName})`,
        data: olderReadings
          .filter(r => new Date(r.dateTime) >= detailViewRange.start && new Date(r.dateTime) <= detailViewRange.end)
          .map(reading => ({
            x: new Date(reading.dateTime),
            y: reading.value
          })),
        fill: false,
        backgroundColor: 'rgb(153, 204, 255)',
        borderColor: 'rgba(153, 204, 255, 0.8)',
        tension: 0.1,
        pointRadius: 3,
      },
      {
        label: `Recent ${parameterName} (${unitName})`,
        data: recentReadings
          .filter(r => new Date(r.dateTime) >= detailViewRange.start && new Date(r.dateTime) <= detailViewRange.end)
          .map(reading => ({
            x: new Date(reading.dateTime),
            y: reading.value
          })),
        fill: false,
        backgroundColor: 'rgb(75, 192, 192)',
        borderColor: 'rgba(75, 192, 192, 0.8)',
        tension: 0.1,
        pointRadius: 3,
      }
    ]
  };

  // Regular chart data for the main display
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
  
  // Highlight the most recent reading
  if (readings.length > 0) {
    const lastReading = readings[readings.length - 1];
    // Determine which dataset the most recent reading belongs to
    const datasetIndex = new Date(lastReading.dateTime) >= todayStart ? 1 : 0;
    const dataIndex = datasetIndex === 1 
      ? todayReadings.length - 1 
      : yesterdayReadings.length - 1;
    
    if (chartData.datasets[datasetIndex] && chartData.datasets[datasetIndex].data && chartData.datasets[datasetIndex].data.length > 0) {
      chartData.datasets[datasetIndex].pointBackgroundColor = 
        chartData.datasets[datasetIndex].data.map((_, index) => 
          index === dataIndex ? 'red' : chartData.datasets[datasetIndex].backgroundColor
        );
      
      chartData.datasets[datasetIndex].pointRadius = 
        chartData.datasets[datasetIndex].data.map((_, index) => 
          index === dataIndex ? 5 : 3
        );
    }
    
    // Also highlight in the detail chart if the most recent reading is in that view
    if (new Date(lastReading.dateTime) >= detailViewRange.start && 
        new Date(lastReading.dateTime) <= detailViewRange.end) {
      const detailDatasetIndex = new Date(lastReading.dateTime) >= twentyFourHoursAgo ? 1 : 0;
      const detailData = detailDatasetIndex === 1 ? recentReadings : olderReadings;
      const filteredDetailData = detailData.filter(r => 
        new Date(r.dateTime) >= detailViewRange.start && 
        new Date(r.dateTime) <= detailViewRange.end
      );
      const detailDataIndex = filteredDetailData.findIndex(r => r.dateTime === lastReading.dateTime);
      
      if (detailDataIndex !== -1 && detailChartData.datasets[detailDatasetIndex]) {
        detailChartData.datasets[detailDatasetIndex].pointBackgroundColor = 
          Array(filteredDetailData.length).fill(detailChartData.datasets[detailDatasetIndex].backgroundColor);
        
        if (detailChartData.datasets[detailDatasetIndex].pointBackgroundColor) {
          detailChartData.datasets[detailDatasetIndex].pointBackgroundColor[detailDataIndex] = 'red';
        }
        
        detailChartData.datasets[detailDatasetIndex].pointRadius = 
          Array(filteredDetailData.length).fill(3);
        
        if (detailChartData.datasets[detailDatasetIndex].pointRadius) {
          detailChartData.datasets[detailDatasetIndex].pointRadius[detailDataIndex] = 5;
        }
      }
    }
  }

  // Helper function to get abbreviated unit name
  const getAbbreviatedUnit = (fullUnitName) => {
    if (fullUnitName.includes('Above Station Datum')) return 'mASD';
    if (fullUnitName.includes('Above Ordnance Datum')) return 'mAOD';
    if (fullUnitName.includes('cubic meters per second')) return 'm³/s';
    if (fullUnitName.includes('meters')) return 'm';
    return fullUnitName; // Return original if no match
  };

  // Options for overview chart
  const overviewOptions = {
    responsive: true,
    maintainAspectRatio: false,
    height: 100, // Small height for the overview
    plugins: {
      legend: {
        display: false, // No legend needed for overview
      },
      tooltip: {
        enabled: false, // No tooltips needed for overview
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'day',
          displayFormats: {
            day: 'MMM d'
          }
        },
        title: {
          display: false
        }
      },
      y: {
        display: true,      // Changed from false to true
        ticks: {
          display: true,    // Show tick values
          maxTicksLimit: 3, // Limit to 3 ticks for compactness
          font: {
            size: 9         // Smaller font for the compact view
          }
        },
        title: {
          display: true,
          text: getAbbreviatedUnit(unitName),
          font: {
            size: 10
          }
        }
      }
    }
  };

  // Options for detail chart
  const detailOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: [
          chartTitle,
          `From ${new Date(detailViewRange.start).toLocaleDateString()} to ${new Date(detailViewRange.end).toLocaleDateString()}`
        ],
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
            if (readings.length > 0 && context.dataIndex === readings.length - 1) {
              return `${parameterName}: ${context.parsed.y} ${unitName} (Most Recent)`;
            }
            return `${parameterName}: ${context.parsed.y} ${unitName}`;
          }
        }
      },
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
          },
          twentyFourHourMark: {
            type: 'line',
            xMin: twentyFourHoursAgo,
            xMax: twentyFourHoursAgo,
            borderColor: 'rgba(255, 0, 0, 0.3)',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              content: 'Last 24 Hours',
              enabled: selectedRange !== '24h', // Only show when not in 24h view
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

  // Regular chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: [
          chartTitle,
          readings.length > 0 ? 
            `From ${new Date(readings[0]?.dateTime).toLocaleDateString()} to ${new Date(readings[readings.length-1]?.dateTime).toLocaleDateString()}` : 
            ''
        ],
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
            const isLastPoint = (context.datasetIndex === 1 && context.dataIndex === todayReadings.length - 1) || 
                             (context.datasetIndex === 0 && todayReadings.length === 0 && context.dataIndex === yesterdayReadings.length - 1);
            const label = `${parameterName}: ${context.parsed.y} ${unitName}`;
            return isLastPoint ? `${label} (Most Recent)` : label;
          }
        }
      },
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
  const filteredReadings = detailReadings.filter((reading, index) => {
    // Keep first, last, and readings at 30-minute intervals
    if (index === 0 || index === detailReadings.length - 1) return true;
    
    const readingDate = new Date(reading.dateTime);
    return readingDate.getMinutes() % 30 === 0;
  });

  return (
    <div>
      <TimeRangeSelector 
        selectedRange={selectedRange}
        onRangeChange={handleRangeChange}
        onCustomRangeChange={handleCustomRangeChange}
      />
      
      {/* Main chart section with clarified title */}
      <div className="chart-section">
        <div className="chart-header">
          <h3>Detailed 24-Hour View</h3>
          <span className="date-subtitle">
            From {new Date(detailViewRange.start).toLocaleString()} to {new Date(detailViewRange.end).toLocaleString()}
          </span>
        </div>
        
        <div
          ref={scrollContainerRef}
          style={{
            height: '400px',
            overflowX: 'auto',
            position: 'relative',
            border: '1px solid #ddd'
          }}
        >
          <div style={{ minWidth: '1200px', height: '100%' }}>
            <Line 
              data={selectedRange === '24h' ? chartData : detailChartData} 
              options={{
                ...options,
                plugins: {
                  ...options.plugins,
                  title: {
                    display: false // Remove the confusing title from the chart itself
                  }
                }
              }} 
            />
          </div>
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '20px',
            backgroundColor: 'rgba(255,255,255,0.7)',
            padding: '5px',
            borderRadius: '5px',
            boxShadow: '0 0 5px rgba(0,0,0,0.2)',
            zIndex: 10
          }}>
            <span style={{ color: 'red', fontWeight: 'bold', marginRight: '5px' }}>●</span>
            Most Recent Reading
          </div>
        </div>
      </div>
      
      {/* Overview mini-chart - only show for longer time periods */}
      {selectedRange !== '24h' && (
        <div className="overview-section">
          <div className="chart-header">
            <h3>Full {chartTitle} Overview</h3>
            <span className="date-subtitle">
              From {new Date(readings[0]?.dateTime).toLocaleDateString()} to {new Date(readings[readings.length-1]?.dateTime).toLocaleDateString()}
            </span>
          </div>
          
          <div className="overview-chart" style={{ height: '120px', marginTop: '10px', position: 'relative' }}>
            {/* Add this highlighted region indicator */}
            <div 
              style={{
                position: 'absolute',
                left: `${getPositionPercentage(detailViewRange.start, readings)}%`,
                width: `${getDetailRangeWidthPercentage(detailViewRange, readings)}%`,
                height: '100%',
                backgroundColor: 'rgba(75, 192, 192, 0.15)',
                border: '1px dashed rgba(75, 192, 192, 0.5)',
                zIndex: 5,
                pointerEvents: 'none'
              }}
            />
            <Line data={overviewChartData} options={overviewOptions} />
          </div>
        </div>
      )}
      
      <h3>Readings Table (30min intervals)</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="readings-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>{parameterName} ({unitName})</th>
            </tr>
          </thead>
          <tbody>
            {filteredReadings.map((reading, index) => (
              <tr key={index} className={index === filteredReadings.length - 1 ? 'current-reading' : ''}>
                <td>{new Date(reading.dateTime).toLocaleString()}</td>
                <td>{reading.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default ReadingsChart;