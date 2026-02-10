/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CUBE_API_URL?: string;
  readonly VITE_CUBE_EMBED_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

