/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [...["/api/admin/:path*", "/api/feedback", "/admin"].map(source => ({
      source,
      headers: [{ key: "Cache-Control", value: "private, no-store" }],
    })), {
      source: "/playground/preview",
      headers: [{ key: "Content-Security-Policy", value: "connect-src 'self'; worker-src 'none'; form-action 'none'; img-src 'self' data: blob:;" }],
    }]
  },
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
