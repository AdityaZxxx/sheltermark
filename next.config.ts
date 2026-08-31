import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Allow the dev server to be reached from any host (e.g. a phone on the same
  // Wi-Fi hitting http://<laptop-lan-ip>:3000). The IP changes per network,
  // so we accept anything rather than hardcoding a specific address.
  // See: https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
  allowedDevOrigins: ["192.168.1.*"],
  // jsdom is loaded through an eval'ed runtime require (see
  // lib/extract/readability.ts) to dodge Turbopack's hashed-alias externals,
  // which break in Vercel lambdas (vercel/next.js#89851). The tracer can no
  // longer see that import, so force-include jsdom's full dependency tree.
  outputFileTracingIncludes: {
    "/api/preview": [
      "./node_modules/@asamuzakjp/css-color/**/*",
      "./node_modules/@asamuzakjp/dom-selector/**/*",
      "./node_modules/@bramus/specificity/**/*",
      "./node_modules/@csstools/color-helpers/**/*",
      "./node_modules/@csstools/css-calc/**/*",
      "./node_modules/@csstools/css-color-parser/**/*",
      "./node_modules/@csstools/css-parser-algorithms/**/*",
      "./node_modules/@csstools/css-syntax-patches-for-csstree/**/*",
      "./node_modules/@csstools/css-tokenizer/**/*",
      "./node_modules/@exodus/bytes/**/*",
      "./node_modules/@mozilla/readability/**/*",
      "./node_modules/bidi-js/**/*",
      "./node_modules/css-tree/**/*",
      "./node_modules/data-urls/**/*",
      "./node_modules/decimal.js/**/*",
      "./node_modules/entities/**/*",
      "./node_modules/html-encoding-sniffer/**/*",
      "./node_modules/iconv-lite/**/*",
      "./node_modules/is-potential-custom-element-name/**/*",
      "./node_modules/jsdom/**/*",
      "./node_modules/lru-cache/**/*",
      "./node_modules/mdn-data/**/*",
      "./node_modules/parse5/**/*",
      "./node_modules/punycode/**/*",
      "./node_modules/require-from-string/**/*",
      "./node_modules/saxes/**/*",
      "./node_modules/source-map-js/**/*",
      "./node_modules/symbol-tree/**/*",
      "./node_modules/tldts/**/*",
      "./node_modules/tldts-core/**/*",
      "./node_modules/tough-cookie/**/*",
      "./node_modules/tr46/**/*",
      "./node_modules/undici/**/*",
      "./node_modules/w3c-xmlserializer/**/*",
      "./node_modules/webidl-conversions/**/*",
      "./node_modules/whatwg-encoding/**/*",
      "./node_modules/whatwg-mimetype/**/*",
      "./node_modules/whatwg-url/**/*",
      "./node_modules/xml-name-validator/**/*",
      "./node_modules/xmlchars/**/*",
    ],
  },
};

export default nextConfig;
