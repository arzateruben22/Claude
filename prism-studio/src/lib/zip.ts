// A minimal store-only ZIP writer (no compression: videos don't shrink) for the Upload Desk bundle.
// Files are streamed from disk (pull-based, so memory stays flat); each CRC is computed before its header.
import fs from "node:fs";
import { crc32 } from "node:zlib";

export type ZipEntry = { name: string; path?: string; data?: Buffer };

async function crcOfFile(p: string): Promise<number> {
  let c = 0;
  for await (const chunk of fs.createReadStream(p, { highWaterMark: 1 << 20 })) c = crc32(chunk as Buffer, c);
  return c >>> 0;
}

/** A pull-based web stream over an async generator: backpressure for free, and a client that goes away
 *  (closed tab, cancelled download) simply stops the generator instead of erroring a closed controller. */
export function webStream(gen: AsyncGenerator<Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async pull(ctrl) {
      try {
        const { value, done } = await gen.next();
        if (done) ctrl.close(); else ctrl.enqueue(value);
      } catch (e) { ctrl.error(e); }
    },
    async cancel() { await gen.return(undefined); },
  });
}

export async function* fileChunks(p: string, range?: { start: number; end: number }): AsyncGenerator<Uint8Array> {
  const rs = fs.createReadStream(p, { highWaterMark: 1 << 20, ...range });
  try { for await (const chunk of rs) yield chunk as Buffer; } finally { rs.destroy(); }
}

async function* zipChunks(entries: ZipEntry[]): AsyncGenerator<Uint8Array> {
  const central: Buffer[] = [];
  let offset = 0;
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const size = e.data ? e.data.length : fs.statSync(e.path!).size;
    if (size >= 0xffffffff) throw new Error("file too large for a plain zip");
    const crc = e.data ? crc32(e.data) >>> 0 : await crcOfFile(e.path!);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);   // UTF-8 names, stored
    local.writeUInt16LE(time, 10); local.writeUInt16LE(date, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18); local.writeUInt32LE(size, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    yield Buffer.concat([local, name]);
    if (e.data) yield e.data; else yield* fileChunks(e.path!);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(0, 10);
    cen.writeUInt16LE(time, 12); cen.writeUInt16LE(date, 14); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(size, 20); cen.writeUInt32LE(size, 24);
    cen.writeUInt16LE(name.length, 28); cen.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cen, name]));
    offset += 30 + name.length + size;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  yield Buffer.concat([cd, end]);
}

export const zipStream = (entries: ZipEntry[]) => webStream(zipChunks(entries));
