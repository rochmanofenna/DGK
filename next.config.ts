import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // POD upload accepts up to 5 images at 2 MiB each; default 1 MB cap
      // would reject the request before our validation runs.
      bodySizeLimit: "15mb",
    },
  },
}

export default nextConfig
