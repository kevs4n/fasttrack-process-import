#!/usr/bin/env python3
"""
FastAPI Server Runner
"""
import sys
import os

# Add the src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

if __name__ == "__main__":
    import uvicorn
    from src.app import app
    
    print("🚀 Starting FastAPI server on port 8085...")
    print("📱 Access the web interface at: http://localhost:8085")
    print("🏥 Health check at: http://localhost:8085/health")
    print("📚 API docs at: http://localhost:8085/docs")
    print("Press Ctrl+C to stop the server")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8085,
        log_level="info"
    )
