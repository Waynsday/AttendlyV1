#!/bin/bash

# =====================================================
# Aeries Connection Test Script
# =====================================================

echo "🧪 Testing Aeries Connection..."
echo "================================"

# Check if certificate exists
if [ ! -f "./certs/aeries-client.crt" ]; then
    echo "❌ Certificate not found at ./certs/aeries-client.crt"
    echo "Please run: ./setup-certificate.sh first"
    exit 1
fi

echo "✅ Certificate found"

# Check environment variables
if [ ! -f ".env.local" ]; then
    echo "⚠️  .env.local not found, creating from template..."
    cp .env.local.template .env.local
    echo "✅ Created .env.local"
fi

# Start the server in background
echo "🚀 Starting development server..."
npm run dev &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 10

# Test connection
echo "🔍 Testing Aeries connection..."
echo "================================"

# Test 1: Basic connection
echo -e "\n1️⃣ Testing basic connection:"
curl -s "http://localhost:3000/api/aeries/test?test=connection" | jq '.'

# Test 2: Configuration
echo -e "\n2️⃣ Testing configuration:"
curl -s "http://localhost:3000/api/aeries/test?test=config" | jq '.'

# Test 3: Schools
echo -e "\n3️⃣ Testing schools endpoint:"
curl -s "http://localhost:3000/api/aeries/test?test=schools" | jq '.'

# Test 4: Attendance
echo -e "\n4️⃣ Testing attendance for Aug 15, 2024:"
curl -s "http://localhost:3000/api/aeries/test?test=attendance&date=2024-08-15" | jq '.'

# Kill the server
echo -e "\n🛑 Stopping server..."
kill $SERVER_PID 2>/dev/null

echo -e "\n✅ Test complete!"
echo "================================"
echo "If you see 'connected: true' above, your certificate is working!"