import "server-only";
export function applicationOrigin(requestUrl: string) {
  return new URL(
    process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || requestUrl,
  ).origin;
}
