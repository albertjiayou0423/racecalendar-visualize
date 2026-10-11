/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return ["/api/admin/:path*", "/api/feedback", "/admin"].map(source => ({
      source,
      headers: [{ key: "Cache-Control", value: "private, no-store" }],
    }))
  },
images: {
    unoptimized: true,
  },
  allowedDevOrigins: [
    "run-agent-6a5609cb9bd0b55fe2fee544-mrvfqnrd.remote-agent.svc.cluster.local",
  ],
}

export default nextConfig
