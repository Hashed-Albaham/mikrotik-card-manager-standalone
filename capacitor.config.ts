import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mikrotik.cardmanager",
  appName: "MikroTik Card Manager",
  webDir: "dist",
  server: { androidScheme: "https" }
};

export default config;
