import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aistudio.applet',
  appName: 'VM.MOEX',
  webDir: 'out',
  /* 
   * Uncomment and replace with your deployed App URL to wrap the hosted version
   * This is recommended because the app uses Next.js server-side API routes (/api/tinvest)
   * which cannot run inside a static APK.
   */
  // server: {
  //   url: 'https://ais-pre-fdh6dgu6slllmagdfyelbi-11687317277.asia-northeast1.run.app',
  //   cleartext: true
  // },
};

export default config;
