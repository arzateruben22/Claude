import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveMedia } from "../src/lib/media";
import { captionsToSrt } from "../src/domain/srt";
import { zipStream } from "../src/lib/zip";
import { makeSession, verifySession } from "../src/lib/session";
import { checkPassword, hashPassword } from "../src/lib/auth";

describe("media keys", () => {
  it("resolve inside the allow-listed roots only", () => {
    process.env.FILMS_REPO_ROOT = "/repo"; process.env.MEDIA_ROOT = "/data/media";
    expect(resolveMedia("films:channels/physics/ep01/out/a.mp4")).toBe("/repo/films/channels/physics/ep01/out/a.mp4");
    expect(resolveMedia("films:films/channels/x.jpg")).toBe("/repo/films/channels/x.jpg");
    expect(resolveMedia("films:../../etc/passwd")).toBeNull();
    expect(resolveMedia("films:channels/../../secret.mp4")).toBeNull();
    expect(resolveMedia("films:channels/physics/ep01/script.md")).toBeNull();   // not a media type
    expect(resolveMedia("media:../../.env.local")).toBeNull();
    expect(resolveMedia("/etc/passwd")).toBeNull();
    expect(resolveMedia("media:exports/a.mp4")).toBe("/data/media/exports/a.mp4");
  });
});

describe("captions", () => {
  it("writes SubRip from the film's word-timed captions", () => {
    const srt = captionsToSrt([{ t0: 0.12, t1: 1.685, lines: [[["Which", 0.12], ["*ball*", 0.3]]] }, { t0: 61.5, t1: 63, lines: [[["a", 61.5]], [["b", 62]]] }]);
    expect(srt).toBe("1\n00:00:00,120 --> 00:00:01,685\nWhich ball\n\n2\n00:01:01,500 --> 00:01:03,000\na\nb\n");
  });
});

describe("zip bundle", () => {
  it("produces an archive that unzip verifies", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "prism-zip-"));
    const big = path.join(dir, "v.bin");
    fs.writeFileSync(big, Buffer.alloc(3 * 1024 * 1024 + 17, 7));
    const chunks: Uint8Array[] = [];
    const reader = zipStream([{ name: "video.mp4", path: big }, { name: "caption — ünïcode.txt", data: Buffer.from("hello") }]).getReader();
    for (;;) { const { value, done } = await reader.read(); if (done) break; chunks.push(value); }
    const zip = path.join(dir, "b.zip");
    fs.writeFileSync(zip, Buffer.concat(chunks));
    const out = execFileSync("python3", ["-c", "import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print(z.testzip(), [(i.filename,i.file_size) for i in z.infolist()])", zip]).toString();
    expect(out).toContain("None");
    expect(out).toContain("('video.mp4', 3145745)");
    expect(out).toContain("caption — ünïcode.txt");
  });
});

describe("owner sign-in", () => {
  it("checks the scrypt passphrase", () => {
    const h = hashPassword("correct horse");
    expect(checkPassword("correct horse", h)).toBe(true);
    expect(checkPassword("wrong", h)).toBe(false);
    expect(checkPassword("x", "")).toBe(false);
  });
  it("session cookies resist tampering and expire", async () => {
    process.env.SESSION_SECRET = "s".repeat(40);
    const s = await makeSession(Date.now());
    expect(await verifySession(s.value)).toBe(true);
    const [p, sig] = s.value.split(".");
    expect(await verifySession(`${p}x.${sig}`)).toBe(false);
    expect(await verifySession(`${p}.${sig.slice(0, -2)}AA`)).toBe(false);
    expect(await verifySession(s.value, Date.now() + 31 * 86_400_000)).toBe(false);
    expect(await verifySession(undefined)).toBe(false);
  });
});
