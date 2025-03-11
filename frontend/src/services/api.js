import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export const getStations = async (params = {}) => {
  try {
    const response = await axios.get(`${API_URL}/stations`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching stations:', error);
    throw error;
  }
};

export const getStationReadings = async (stationId, params = {}) => {
  try {
    const response = await axios.get(`${API_URL}/stations/${stationId}/readings`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching station readings:', error);
    throw error;
  }
};