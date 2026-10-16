// Image imports resolve to a URL (Vite); the single-file build turns them into data URIs.
declare module '*.webp' { const url: string; export default url; }
declare module '*.png' { const url: string; export default url; }
