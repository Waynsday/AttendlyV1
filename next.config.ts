import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable experimental features for better development experience
  experimental: {
    // Fix hydration issues with server components
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },
  
  // Configure webpack for better dev tools support
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Disable React DevTools warnings in development
      config.resolve.alias = {
        ...config.resolve.alias,
        'react-dom$': 'react-dom/profiling',
        'scheduler/tracing': 'scheduler/tracing-profiling',
      };
    }
    return config;
  },
  
  // Environment configuration
  env: {
    ATTENDLY_VERSION: '1.0.0',
    FERPA_COMPLIANCE_MODE: 'enabled',
  },
  
  // Optimize for education domain
  headers: async () => [
    {
      source: '/api/:path*',
      headers: [
        {
          key: 'X-Student-Data-Protection',
          value: 'FERPA-Compliant',
        },
        {
          key: 'X-Educational-System',
          value: 'AttendlyV1-Romoland',
        },
      ],
    },
  ],
  
  // Redirects for better UX
  redirects: async () => [
    {
      source: '/admin',
      destination: '/dashboard',
      permanent: false,
    },
  ],
};

export default nextConfig;
