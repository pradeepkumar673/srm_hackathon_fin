/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOCKET_URL: string
  readonly VITE_GROQ_API_KEY: string
  readonly VITE_ROBOFLOW_API_KEY: string
  readonly VITE_OPENWEATHER_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
