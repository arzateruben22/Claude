// Lumevina — the studio key: what lets Evelyn's dashboard into the functions
// that change records (gift certificates, skin plans).
//
//   supabase secrets set STUDIO_KEY=<a long random phrase only Evelyn's dashboard knows: 20 characters at least>
//
// The dashboard sends it as the x-studio-key header. Compared in constant time.

export const studioOk = (req: Request) => {
  const want = Deno.env.get("STUDIO_KEY") ?? "";
  const got = req.headers.get("x-studio-key") ?? "";
  if (want.length < 20 || got.length !== want.length) return false;   // a short key is no key: the function stays shut
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
};
