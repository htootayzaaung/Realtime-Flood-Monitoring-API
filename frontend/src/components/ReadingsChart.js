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
        
        // Set detail view range to show the entire selected time period
        setDetailViewRange({
          start: since,
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
      
      // Extract parameter from URL if not found directly
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
      
      // If parameter is 'Flow', use the correct unit even if not specified
      if (parameterName === 'Flow') {
        parameterName = 'Flow rate'; // Change "Flow" to "Flow rate"
        if (unitName === 'Value') {
          unitName = 'm³/s';  // Set the correct unit without parentheses
        }
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
  
  useEffect(() => {
    if (scrollContainerRef.current && readings.length > 0) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, [readings]);

  if (!stationId) return <div>Select a station to view readings</div>;
  if (loading) return <div>Loading readings...</div>;
  if (error) return <div>Error: {error}</div>;
  if (readings.length === 0) return <div>No readings available for this station</div>;

  // Dynamically determine the threshold based on selected range
  let thresholdDate;
  const now = new Date();

  switch(selectedRange) {
    case '24h':
      // For 24h view, split at midnight
      thresholdDate = new Date().setHours(0, 0, 0, 0);
      break;
    case '48h':
      // For 48h view, split at 24 hours ago (midpoint)
      thresholdDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'week':
      // For week view, split between last 6 days and today
      thresholdDate = new Date().setHours(0, 0, 0, 0); // Start of today
      break;
    case 'month':
      // Keep your existing code for month view
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 for Sunday, 1 for Monday, etc.
      // Calculate the start of the current week (Sunday)
      thresholdDate = new Date(today.setDate(today.getDate() - dayOfWeek)).setHours(0, 0, 0, 0);
      break;
    default:
      thresholdDate = new Date().setHours(0, 0, 0, 0);
  }

  // Split readings based on the dynamic threshold
  const olderReadings = readings.filter(r => new Date(r.dateTime) < thresholdDate);
  const recentReadings = readings.filter(r => new Date(r.dateTime) >= thresholdDate);

  // Keep these variables for backward compatibility with existing code
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const yesterdayReadings = selectedRange === '24h' ? 
    readings.filter(r => new Date(r.dateTime) < todayStart) : olderReadings;
  const todayReadings = selectedRange === '24h' ? 
    readings.filter(r => new Date(r.dateTime) >= todayStart) : recentReadings;

  // Filter readings for the detail view
  const detailReadings = readings.filter(r => {
    const time = new Date(r.dateTime);
    return time >= detailViewRange.start && time <= detailViewRange.end;
  });
  
  // Dynamically select dataset labels based on the time range
  let olderLabel, recentLabel;
  switch(selectedRange) {
    case '24h':
      olderLabel = `Yesterday's ${parameterName}`;
      recentLabel = `Today's ${parameterName}`;
      break;
    case '48h':
      olderLabel = `Yesterday's ${parameterName}`;
      recentLabel = `Today's ${parameterName}`;
      break;
    case 'week':
      olderLabel = `Last 6 Days ${parameterName}`;
      recentLabel = `Today's ${parameterName}`;
      break;
    case 'month':
      olderLabel = `Last 3 Weeks ${parameterName}`;
      recentLabel = `Current Week ${parameterName}`;
      break;
    default:
      olderLabel = `Older ${parameterName}`;
      recentLabel = `Recent ${parameterName}`;
  }

  // Prepare data for detail chart (selected range)
  const detailChartData = {
    datasets: [
      {
        label: `${olderLabel} (${unitName})`,
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
        label: `${recentLabel} (${unitName})`,
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

  // Modified version that keeps your existing color scheme
  const unifiedChartData = {
    datasets: [{
      label: `${parameterName} (${unitName})`,
      data: readings.map(reading => ({
        x: new Date(reading.dateTime),
        y: reading.value
      })),
      fill: false,
      // Point colors
      pointBackgroundColor: context => {
        if (!context.dataIndex || !context.dataset.data[context.dataIndex]) return 'rgb(153, 204, 255)';
        const value = context.dataset.data[context.dataIndex].x;
        
        // Red for the most recent reading
        if (context.dataIndex === readings.length - 1) {
          return 'red';
        }
        
        // Otherwise, use color based on the threshold
        return new Date(value) < thresholdDate ? 
          'rgb(153, 204, 255)' : 'rgb(75, 192, 192)';
      },
      // Line colors - this is crucial for fixing the issue
      segment: {
        borderColor: context => {
          // If we have no points, return default color
          if (!context.p0 || !context.p1) return 'rgba(75, 192, 192, 0.8)';
          
          // Get dates for the two points of this line segment
          const p0Date = context.p0.parsed.x;
          const p1Date = context.p1.parsed.x;
          
          // If both points are before the threshold, use blue
          if (p0Date < thresholdDate && p1Date < thresholdDate) {
            return 'rgba(153, 204, 255, 0.8)';
          }
          
          // If both points are after the threshold, use green
          if (p0Date >= thresholdDate && p1Date >= thresholdDate) {
            return 'rgba(75, 192, 192, 0.8)';
          }
          
          // If the segment crosses the threshold, create a gradient
          // For simplicity, just use the older color
          return 'rgba(153, 204, 255, 0.8)';
        }
      },
      borderColor: 'rgba(75, 192, 192, 0.8)', // Default fallback
      pointRadius: context => {
        // Make the most recent reading point larger
        return context.dataIndex === readings.length - 1 ? 5 : 3;
      },
      tension: 0.1
    }]
  };

  const lastReading = readings.length > 0 ? readings[readings.length - 1] : null;

  
  // Also highlight in the detail chart if the most recent reading is in that view
  if (lastReading && detailViewRange.start && detailViewRange.end && 
    new Date(lastReading.dateTime) >= detailViewRange.start && 
    new Date(lastReading.dateTime) <= detailViewRange.end) {
    const detailDatasetIndex = new Date(lastReading.dateTime) >= thresholdDate ? 1 : 0;
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

  // Helper function to get abbreviated unit name
  const getAbbreviatedUnit = (fullUnitName) => {
    if (fullUnitName.includes('Above Station Datum')) return 'mASD';
    if (fullUnitName.includes('Above Ordnance Datum')) return 'mAOD';
    if (fullUnitName.includes('cubic meters per second')) return 'm³/s';
    if (fullUnitName.includes('meters')) return 'm';
    return fullUnitName; // Return original if no match
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
            display: selectedRange === '24h', // Add this line
            label: {
              content: 'Midnight',
              enabled: selectedRange === '24h',
              position: 'top'
            }
          },
          thresholdLine: {
            type: 'line',
            xMin: thresholdDate,
            xMax: thresholdDate,
            borderColor: 'rgba(255, 0, 0, 0.7)',
            borderWidth: 2,
            borderDash: [5, 5],
            display: selectedRange !== '24h', // Add this line
            label: {
              content: selectedRange === '48h' ? 'Yesterday/Today' : 
                       selectedRange === 'week' ? 'Last 6 Days/Today' : 
                       selectedRange === 'month' ? 'Last 3 Weeks/Current Week' : 'Threshold',
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
            display: selectedRange === '24h',
            label: {
              content: 'Midnight',
              enabled: selectedRange === '24h', // Only show for 24h view
              position: 'top'
            }
          },
          thresholdLine: {
            type: 'line',
            xMin: thresholdDate,
            xMax: thresholdDate,
            borderColor: 'rgba(255, 0, 0, 0.7)', // Make it more visible
            borderWidth: 2,
            borderDash: [5, 5],
            display: selectedRange !== '24h',
            label: {
              content: selectedRange === '48h' ? 'Yesterday/Today' : 
                       selectedRange === 'week' ? 'Last 6 Days/Today' : 
                       selectedRange === 'month' ? 'Last 3 Weeks/Current Week' : 'Threshold',
              enabled: true, // Show for all applicable views
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

  // Helper function to create a gradient for the boundary segment
  // Add this function if it's not already defined
  const createGradient = (chart) => {
    const ctx = chart.ctx;
    const gradient = ctx.createLinearGradient(0, 0, 100, 0); // horizontal gradient
    
    // Start with the "older" color
    gradient.addColorStop(0, 'rgba(153, 204, 255, 0.8)');
    // End with the "recent" color
    gradient.addColorStop(1, 'rgba(75, 192, 192, 0.8)');
    
    return gradient;
  };


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
        <h3>Detailed {selectedRange === '24h' ? '24-Hour' : chartTitle} View</h3>
        <span className="date-subtitle">
          From {new Date(detailViewRange.start).toLocaleString()} to {new Date(detailViewRange.end).toLocaleString()}
          <span style={{ marginLeft: '10px', fontSize: '0.9em', color: '#666' }}>
            {selectedRange === '24h' 
              ? "(Red line marks midnight)" 
              : `(Red line marks division between ${
                  selectedRange === '48h' ? 'yesterday and today' : 
                  selectedRange === 'week' ? 'last 6 days and today' : 
                  'last 3 weeks and current week'
                })`
            }
          </span>
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
            data={unifiedChartData} 
            options={{
              ...options,
              plugins: {
                // Keep the annotation configuration explicitly
                annotation: options.plugins.annotation,
                // Other plugin settings
                title: {
                  display: false
                },
                legend: {
                  labels: {
                    generateLabels: () => [
                      {
                        text: olderLabel,
                        fillStyle: 'rgb(153, 204, 255)',
                        strokeStyle: 'rgba(153, 204, 255, 0.8)',
                        lineWidth: 1,
                        hidden: false
                      }, 
                      {
                        text: recentLabel,
                        fillStyle: 'rgb(75, 192, 192)',
                        strokeStyle: 'rgba(75, 192, 192, 0.8)',
                        lineWidth: 1,
                        hidden: false
                      }
                    ],
                    usePointStyle: true
                  },
                  onClick: () => {} // Disable toggling datasets on/off
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