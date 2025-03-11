import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    """Base configuration."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-key-should-be-changed')
    API_BASE_URL = 'https://environment.data.gov.uk/flood-monitoring'
    CACHE_TIMEOUT = 300  # 5 minutes cache timeout