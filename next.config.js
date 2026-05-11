const isDev = process.env.NODE_ENV === 'development'

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: isDev,
  register: !isDev,
  skipWaiting: true,
  cacheOnFrontEndNav: !isDev,
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'fal.media',
      },
      {
        protocol: 'https',
        hostname: '**.fal.ai',
      },
    ],
  },
}

module.exports = withPWA(nextConfig)
