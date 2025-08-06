#!/usr/bin/env python3
"""
Simple test script to verify the Fasttrack Process Model Import Tool setup
"""

import sys
import os

def test_python_version():
    """Test Python version"""
    print(f"✓ Python version: {sys.version}")
    if sys.version_info < (3, 9):
        print("⚠️  Warning: Python 3.9+ recommended")
    else:
        print("✓ Python version is compatible")

def test_imports():
    """Test required imports"""
    required_modules = [
        'fastapi',
        'uvicorn',
        'pandas', 
        'requests',
        'json',
        'os',
        'datetime'
    ]
    
    print("\nTesting required modules:")
    for module in required_modules:
        try:
            __import__(module)
            print(f"✓ {module}")
        except ImportError as e:
            print(f"✗ {module} - {e}")

def test_directories():
    """Test required directories"""
    required_dirs = [
        'data',
        'data/uploads', 
        'data/downloads',
        'data/models',
        'data/exports'
    ]
    
    print("\nTesting directories:")
    for dir_path in required_dirs:
        if os.path.exists(dir_path):
            print(f"✓ {dir_path}")
        else:
            print(f"✗ {dir_path} (missing)")
            try:
                os.makedirs(dir_path, exist_ok=True)
                print(f"  → Created {dir_path}")
            except Exception as e:
                print(f"  → Failed to create {dir_path}: {e}")

def test_app_structure():
    """Test application file structure"""
    required_files = [
        'src/app.py',
        'src/config.py',
        'src/services/__init__.py',
        'src/services/excel_processor.py',
        'src/services/github_client.py', 
        'src/services/azure_devops_client.py',
        'src/utils/__init__.py',
        'src/utils/logger.py',
        'static/index.html',
        'static/app.js',
        'requirements.txt',
        'Dockerfile',
        'machete.yml'
    ]
    
    print("\nTesting file structure:")
    for file_path in required_files:
        if os.path.exists(file_path):
            print(f"✓ {file_path}")
        else:
            print(f"✗ {file_path} (missing)")

def test_fastapi_app():
    """Test FastAPI app can be imported"""
    print("\nTesting FastAPI application:")
    try:
        sys.path.insert(0, 'src')
        from app import app
        print("✓ FastAPI app imported successfully")
        
        # Test with FastAPI test client
        from fastapi.testclient import TestClient
        client = TestClient(app)
        
        response = client.get('/health')
        if response.status_code == 200:
            print("✓ Health endpoint working")
            print(f"  Response: {response.json()}")
        else:
            print(f"✗ Health endpoint failed: {response.status_code}")
                
    except Exception as e:
        print(f"✗ FastAPI app import failed: {e}")

if __name__ == "__main__":
    print("🧪 Fasttrack Process Model Import Tool - Local Test")
    print("=" * 60)
    
    test_python_version()
    test_imports()
    test_directories()
    test_app_structure()
    test_fastapi_app()
    
    print("\n" + "=" * 60)
    print("✅ Test complete! Check for any ✗ marks above.")
    print("📝 If modules are missing, run: py -m pip install -r requirements.txt")
    print("🚀 If all tests pass, run: uvicorn src.app:app --host 0.0.0.0 --port 8085")
