/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/literate-broccoli',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
}

module.exports = nextConfig
