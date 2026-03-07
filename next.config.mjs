/** @type {import('next').NextConfig} */
const nextConfig = {
    // Allow large file uploads for floor plan images (default is 4MB)
    experimental: {
        serverActions: {
            bodySizeLimit: '50mb',
        },
    },
};

export default nextConfig;
