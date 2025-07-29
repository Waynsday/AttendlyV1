#!/bin/bash

# =====================================================
# Certificate Setup Script
# =====================================================

echo "🔐 Setting up Aeries Certificate..."

# Create certificate directory
echo "📁 Creating certificate directory..."
mkdir -p ./certs
chmod 700 ./certs

# Create certificate file
echo "📝 Creating certificate file..."
cat > ./certs/aeries-client.crt << 'EOF'
-----BEGIN CERTIFICATE-----
e815603e5ccc48aab197771eada7a4c6
-----END CERTIFICATE-----
EOF

# Set proper permissions
echo "🔒 Setting secure permissions..."
chmod 600 ./certs/aeries-client.crt

# Verify certificate was created
if [ -f "./certs/aeries-client.crt" ]; then
    echo "✅ Certificate file created successfully!"
    echo "📍 Location: ./certs/aeries-client.crt"
    ls -la ./certs/aeries-client.crt
else
    echo "❌ Failed to create certificate file"
    exit 1
fi

echo ""
echo "🎉 Certificate setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit this file and replace PASTE_YOUR_CERTIFICATE_KEY_HERE with your actual certificate"
echo "2. Run this script again: ./setup-certificate.sh"
echo "3. Test the connection: npm run dev && curl http://localhost:3000/api/aeries/test"