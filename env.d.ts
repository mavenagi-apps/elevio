declare namespace NodeJS {
  interface ProcessEnv {
    MAVENAGI_APP_ID: string;
    MAVENAGI_APP_SECRET: string;
    INNGEST_EVENT_KEY: string;
    INNGEST_SIGNING_KEY: string;
  }
}
