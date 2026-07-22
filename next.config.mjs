/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: [
    "run-agent-6a5609cb9bd0b55fe2fee544-mrvfqnrd.remote-agent.svc.cluster.local",
  ],
}

export default nextConfig
