import React from 'react';
import DatePicker from 'react-datepicker'; // You'll need to install this package
import 'react-datepicker/dist/react-datepicker.css';

const TimeRangeSelector = ({ selectedRange, onRangeChange, onCustomRangeChange }) => {
    const [showCustomPicker, setShowCustomPicker] = React.useState(false);
    const [customStartDate, setCustomStartDate] = React.useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const [customEndDate, setCustomEndDate] = React.useState(new Date());
    
    const handleRangeButtonClick = (range) => {
      setShowCustomPicker(range === 'custom');
      onRangeChange(range);
    };
    
    const handleCustomRangeApply = () => {
      onCustomRangeChange(customStartDate, customEndDate);
      setShowCustomPicker(false);
    };
    
    return (
      <div className="time-range-selector">
        <div className="range-buttons">
          <button 
            className={`range-button ${selectedRange === '24h' ? 'active' : ''}`} 
            onClick={() => handleRangeButtonClick('24h')}
          >
            Last 24h
          </button>
          <button 
            className={`range-button ${selectedRange === '48h' ? 'active' : ''}`} 
            onClick={() => handleRangeButtonClick('48h')}
          >
            Last 48h
          </button>
          <button 
            className={`range-button ${selectedRange === 'week' ? 'active' : ''}`} 
            onClick={() => handleRangeButtonClick('week')}
          >
            Last Week
          </button>
          <button 
            className={`range-button ${selectedRange === 'month' ? 'active' : ''}`} 
            onClick={() => handleRangeButtonClick('month')}
          >
            Last Month
          </button>
          <button 
            className={`range-button ${selectedRange === 'custom' ? 'active' : ''}`} 
            onClick={() => handleRangeButtonClick('custom')}
          >
            Custom Range ▾
          </button>
        </div>
        
        {showCustomPicker && (
          <div className="custom-range-picker">
            <div className="date-inputs">
              <div>
                <label>Start Date:</label>
                <DatePicker
                  selected={customStartDate}
                  onChange={date => setCustomStartDate(date)}
                  selectsStart
                  startDate={customStartDate}
                  endDate={customEndDate}
                  maxDate={new Date()}
                />
              </div>
              <div>
                <label>End Date:</label>
                <DatePicker
                  selected={customEndDate}
                  onChange={date => setCustomEndDate(date)}
                  selectsEnd
                  startDate={customStartDate}
                  endDate={customEndDate}
                  minDate={customStartDate}
                  maxDate={new Date()}
                />
              </div>
            </div>
            <button 
              className="apply-button" 
              onClick={handleCustomRangeApply}
            >
              Apply
            </button>
          </div>
        )}
      </div>
    );
  };
  
  export default TimeRangeSelector;