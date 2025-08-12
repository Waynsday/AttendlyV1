#!/bin/bash

# Complete iReady Data Upload Script
# This script runs the upload process and logs the output

echo "🚀 Starting complete iReady data upload..."
echo "📅 Started at: $(date)"
echo "================================================"

cd "$(dirname "$0")"

# Run the upload with output logging
node simple-iready-upload.js > iready_upload_$(date +%Y%m%d_%H%M%S).log 2>&1 &

UPLOAD_PID=$!
echo "📊 Upload process started with PID: $UPLOAD_PID"
echo "📄 Logs will be saved to: iready_upload_$(date +%Y%m%d_%H%M%S).log"

# Monitor progress
echo "⏱️  Monitoring progress..."
sleep 5

# Check if process is still running
if kill -0 $UPLOAD_PID 2>/dev/null; then
    echo "✅ Upload process is running successfully"
    echo "🔍 Use 'node verify-iready-upload.js' to check progress"
    echo "📋 Process ID: $UPLOAD_PID"
else
    echo "❌ Upload process failed to start or completed quickly"
fi

echo "================================================"
echo "💡 To monitor progress:"
echo "   • Run: node verify-iready-upload.js"
echo "   • Check log file: tail -f iready_upload_*.log"
echo "   • Kill process if needed: kill $UPLOAD_PID"