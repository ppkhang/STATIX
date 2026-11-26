import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// cacheComponents is off for now: store pages are mostly live data (stock, holds, countdown).
const nextConfig: NextConfig = {};

export default createNextIntlPlugin()(nextConfig);
