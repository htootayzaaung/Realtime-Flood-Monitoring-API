import requests
from flask import current_app
import time

# Simple in-memory cache with timeout
cache = {}

def get_with_cache(url, params=None, timeout=None):
    """Get data from URL with caching"""
    if timeout is None:
        timeout = current_app.config['CACHE_TIMEOUT']
    
    # Create a cache key from URL and params
    cache_key = f"{url}?{str(params)}"
    
    # Check if we have cached data and it's still fresh
    if cache_key in cache:
        cached_time, cached_data = cache[cache_key]
        if time.time() - cached_time < timeout:
            return cached_data
    
    # If not cached or cache expired, fetch new data
    response = requests.get(url, params=params)
    response.raise_for_status()  # Raise exception for HTTP errors
    data = response.json()
    
    # Cache the new data
    cache[cache_key] = (time.time(), data)
    
    return data

def get_stations(params=None):
    """Get stations from the EA API"""
    base_url = current_app.config['API_BASE_URL']
    url = f"{base_url}/id/stations"
    return get_with_cache(url, params)

def get_station_readings(station_id, params=None):
    """Get readings for a specific station"""
    base_url = current_app.config['API_BASE_URL']
    
    if params is None:
        params = {}
    
    # Instead of using 'today', calculate a timestamp for 24 hours ago
    if not params.get('today') and not params.get('since') and not params.get('date'):
        # Use the 'since' parameter with 24 hours ago timestamp
        from datetime import datetime, timedelta
        yesterday = datetime.now() - timedelta(hours=24)
        params['since'] = yesterday.isoformat()
    
    # Always ensure results are sorted by date
    params['_sorted'] = ''
    
    url = f"{base_url}/id/stations/{station_id}/readings"
    return get_with_cache(url, params)