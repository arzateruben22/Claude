// Print an OWNER_PASSWORD_HASH for a passphrase: npm run owner:password -- "your passphrase"
import { hashPassword } from "../src/lib/auth";
const pass = process.argv[2];
if (!pass || pass.length < 10) { console.error("usage: npm run owner:password -- \"a passphrase of 10+ characters\""); process.exit(2); }
console.log(`OWNER_PASSWORD_HASH=${hashPassword(pass)}`);
