/** @type {import('next').NextConfig} */
const { withNextOnPages } = require("@cloudflare/next-on-pages/next-dev");

const nextConfig = {
  reactStrictMode: true,
};

module.exports = withNextOnPages(nextConfig);
