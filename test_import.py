#!/usr/bin/env python3
"""
Test script to debug import issues
"""
import sys
import os

# Add the src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

try:
    print("Testing imports...")
    
    # Test individual imports
    print("1. Testing config import...")
    from src.config import Config
    print("   ✓ Config imported successfully")
    
    print("2. Testing logger import...")
    from src.utils.logger import setup_logger
    print("   ✓ Logger imported successfully")
    
    print("3. Testing excel processor import...")
    from src.services.excel_processor import ExcelProcessor
    print("   ✓ ExcelProcessor imported successfully")
    
    print("4. Testing github client import...")
    from src.services.github_client import GitHubClient
    print("   ✓ GitHubClient imported successfully")
    
    print("5. Testing azure devops client import...")
    from src.services.azure_devops_client import AzureDevOpsClient
    print("   ✓ AzureDevOpsClient imported successfully")
    
    print("6. Testing main app import...")
    from src.app import app
    print("   ✓ FastAPI app imported successfully")
    
    print("\n🎉 All imports successful! App should be ready to run.")
    
except Exception as e:
    print(f"\n❌ Import error: {e}")
    print(f"Error type: {type(e).__name__}")
    import traceback
    traceback.print_exc()
