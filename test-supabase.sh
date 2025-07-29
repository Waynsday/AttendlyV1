#!/bin/bash

# =====================================================
# Supabase Connection Test Script
# =====================================================

echo "🔗 Testing Supabase Connection..."
echo "================================"

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local not found"
    echo "Please create .env.local with your Supabase credentials"
    exit 1
fi

echo "✅ Found .env.local"

# Check if required Supabase vars are configured
echo "📋 Checking Supabase configuration..."

if ! grep -q "NEXT_PUBLIC_SUPABASE_URL=" .env.local || grep -q "your-supabase-url-here" .env.local; then
    echo "❌ NEXT_PUBLIC_SUPABASE_URL not properly configured"
    echo "Please update .env.local with your Supabase project URL"
    exit 1
fi

if ! grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY=" .env.local || grep -q "your-supabase-anon-key-here" .env.local; then
    echo "❌ NEXT_PUBLIC_SUPABASE_ANON_KEY not properly configured"
    echo "Please update .env.local with your Supabase anonymous key"
    exit 1
fi

if ! grep -q "SUPABASE_SERVICE_ROLE_KEY=" .env.local || grep -q "your-supabase-service-role-key-here" .env.local; then
    echo "⚠️  SUPABASE_SERVICE_ROLE_KEY not configured (optional for basic testing)"
fi

echo "✅ Configuration looks good"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Run the test
echo "🧪 Running Supabase connection test..."
echo "================================"

npx tsx test-supabase.ts