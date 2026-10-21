/**
 * Generates a throw-away self-signed certificate for the HTTPS fixture server
 * using the system `openssl` binary (the test browser runs with
 * --ignore-certificate-errors, so the certificate only has to exist).
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

/**
 * @param {string} dir directory to store key.pem / cert.pem
 * @param {string[]} hosts subject alternative names
 * @returns {{ key: Buffer, cert: Buffer }}
 */
function ensureCerts(dir, hosts) {
  fs.mkdirSync(dir, { recursive: true });
  const keyPath = path.join(dir, "key.pem");
  const certPath = path.join(dir, "cert.pem");
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    const san = ["DNS:localhost", "IP:127.0.0.1", ...hosts.map((h) => `DNS:${h}`)].join(",");
    execFileSync(
      "openssl",
      ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", keyPath, "-out", certPath, "-days", "30", "-subj", "/CN=careerquest-fixtures", "-addext", `subjectAltName=${san}`],
      { stdio: "ignore" },
    );
  }
  return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
}

module.exports = { ensureCerts };
