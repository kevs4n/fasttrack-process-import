#!/usr/bin/env python3
"""
Simple test script to verify the Fasttrack Process Model Import Tool setup
"""
import sys
import os
import requests
import time

def test_health_endpoint():
    """Test the health endpoint"""
    try:
        response = requests.get('http://localhost:8080/health', timeout=5)
        if response.status_code == 200:
            data = response.json()
            print("✅ Health check passed")
            print(f"   Service: {data.get('service')}")
            print(f"   Status: {data.get('status')}")
            print(f"   Version: {data.get('version')}")
            return True
        else:
            print(f"❌ Health check failed with status {response.status_code}")
            return False
    except requests.RequestException as e:
        print(f"❌ Health check failed: {e}")
        return False

def test_api_endpoints():
    """Test various API endpoints"""
    endpoints = [
        ('/api/models', 'Models list'),
        ('/api/github/files', 'GitHub files (may take time)'),
        ('/api/azure-devops/status', 'Azure DevOps status')
    ]
    
    for endpoint, description in endpoints:
        try:
            response = requests.get(f'http://localhost:8080{endpoint}', timeout=30)
            if response.status_code == 200:
                print(f"✅ {description}: OK")
            else:
                print(f"⚠️  {description}: Status {response.status_code}")
        except requests.RequestException as e:
            print(f"❌ {description}: {e}")

def main():
    print("🚀 Testing Fasttrack Process Model Import Tool")
    print("=" * 50)
    
    # Wait a moment for the server to start
    print("Waiting for server to start...")
    time.sleep(2)
    
    # Test health endpoint
    if not test_health_endpoint():
        print("\n❌ Basic health check failed. Make sure the server is running.")
        sys.exit(1)
    
    print("\n🔍 Testing API endpoints...")
    test_api_endpoints()
    
    print("\n✅ Basic tests completed!")
    print("\n📖 Next steps:")
    print("   1. Open http://localhost:8080 in your browser")
    print("   2. Try uploading an Excel file")
    print("   3. Configure Azure DevOps integration")
    print("   4. Test importing from GitHub repository")

if __name__ == '__main__':
    main()
