from flask import Blueprint, jsonify, request
from app.services.ea_service import get_stations, get_station_readings

api_bp = Blueprint('api', __name__, url_prefix='/api')

@api_bp.route('/stations', methods=['GET'])
def stations():
    """Get all stations or filter by parameters"""
    # Forward query parameters to our service
    params = request.args.to_dict()
    stations_data = get_stations(params)
    return jsonify(stations_data)

@api_bp.route('/stations/<station_id>', methods=['GET'])
def station(station_id):
    """Get a specific station"""
    stations_data = get_stations({'stationReference': station_id})
    if stations_data.get('items'):
        return jsonify(stations_data['items'][0])
    return jsonify({'error': 'Station not found'}), 404

@api_bp.route('/stations/<station_id>/readings', methods=['GET'])
def readings(station_id):
    """Get readings for a specific station"""
    # Forward query parameters and add station_id
    params = request.args.to_dict()
    readings_data = get_station_readings(station_id, params)
    return jsonify(readings_data)