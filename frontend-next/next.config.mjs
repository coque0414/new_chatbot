/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['14.58.120.59','impedingly-veracious-haleigh.ngrok-free.dev'],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.discordapp.com" },
      { protocol: "https", hostname: "i.namu.wiki" },
    ],
  },
};

export default nextConfig;