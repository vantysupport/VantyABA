import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ['pdf-parse'],
  // Asegura que los archivos de conocimiento (knowledge-seed/*.md|.txt) se
  // incluyan en el bundle de la función serverless que los indexa.
  outputFileTracingIncludes: {
    '/api/knowledge/seed-archivos': ['./knowledge-seed/**/*'],
  },
}

export default nextConfig;

