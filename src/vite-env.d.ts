/// <reference types="vite/client" />

interface Window {
  cardManagerRuntime?: { capabilities: () => Promise<{ platform: "desktop"; tcp: boolean; rest: boolean }>; sendBatch: (input: { host: string; port: number; username: string; password: string; script: string; scriptName: string }) => Promise<{ scriptName: string; status: "sent" }> };
  Capacitor?: { Plugins?: { MikroTikTransport?: { sendBatch: (input: { host: string; port: number; username: string; password: string; script: string; scriptName: string }) => Promise<{ scriptName: string; status: "sent" }> } } };
}
