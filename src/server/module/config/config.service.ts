/** Public, non-secret facts about this deployment the UI needs (which sign-in buttons to show). */
export function publicConfig() {
  const has = (id?: string, secret?: string) => Boolean(id && secret);
  return {
    providers: {
      google: has(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET),
      github: has(process.env.GITHUB_CLIENT_ID, process.env.GITHUB_CLIENT_SECRET),
    },
  };
}
