from flask import Flask
from flask_cors import CORS
from config import Config

def create_app(config_class=Config):
    """Create and configure the Flask app"""
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Enable CORS
    CORS(app)
    
    # Register blueprints
    from app.api.routes import api_bp
    app.register_blueprint(api_bp)
    
    return app