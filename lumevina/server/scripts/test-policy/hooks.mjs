const STUBS = {
  "npm:web-push@3.6.7": "export default { setVapidDetails() {}, async sendNotification() {} };",
  "npm:@supabase/supabase-js@2": "export const createClient = () => globalThis.__db;",
};
export async function resolve(specifier, context, next) {
  if (STUBS[specifier]) return { url: "data:text/javascript," + encodeURIComponent(STUBS[specifier]), shortCircuit: true };
  if (specifier.startsWith("npm:")) return { url: "data:text/javascript,export default {};", shortCircuit: true };
  return next(specifier, context);
}
