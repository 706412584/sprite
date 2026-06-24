// 最小 ZIP 写入器（store 模式，无压缩）
// 不引入 JSZip 依赖。仅满足把 ske.json / tex.json / tex.png / spine.json / .skel 等少量文件打成 zip 下载。

interface ZipEntry {
  name: string;
  data: Uint8Array;
  crc32: number;
  size: number;
  offset: number;
}

const CRC_TABLE = makeCrcTable();

function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function strToUtf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function dosTime(): { time: number; date: number } {
  const d = new Date();
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() / 2) & 0x1f);
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0xf) << 5) | (d.getDate() & 0x1f);
  return { time, date };
}

function writeUint16LE(buf: Uint8Array, offset: number, value: number) {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32LE(buf: Uint8Array, offset: number, value: number) {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
  buf[offset + 2] = (value >>> 16) & 0xff;
  buf[offset + 3] = (value >>> 24) & 0xff;
}

export function buildZip(files: Array<{ name: string; data: Uint8Array | string }>): Uint8Array {
  const entries: ZipEntry[] = [];
  const localChunks: Uint8Array[] = [];
  const { time, date } = dosTime();
  let cursor = 0;

  for (const f of files) {
    const data = typeof f.data === "string" ? strToUtf8(f.data) : f.data;
    const nameBytes = strToUtf8(f.name);
    const crc = crc32(data);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeUint32LE(localHeader, 0, 0x04034b50);
    writeUint16LE(localHeader, 4, 20); // version
    writeUint16LE(localHeader, 6, 0); // gp flag
    writeUint16LE(localHeader, 8, 0); // method = stored
    writeUint16LE(localHeader, 10, time);
    writeUint16LE(localHeader, 12, date);
    writeUint32LE(localHeader, 14, crc);
    writeUint32LE(localHeader, 18, data.length);
    writeUint32LE(localHeader, 22, data.length);
    writeUint16LE(localHeader, 26, nameBytes.length);
    writeUint16LE(localHeader, 28, 0);
    localHeader.set(nameBytes, 30);
    localChunks.push(localHeader);
    localChunks.push(data);
    entries.push({ name: f.name, data, crc32: crc, size: data.length, offset: cursor });
    cursor += localHeader.length + data.length;
  }

  // central directory
  const centralChunks: Uint8Array[] = [];
  let centralSize = 0;
  for (const e of entries) {
    const nameBytes = strToUtf8(e.name);
    const head = new Uint8Array(46 + nameBytes.length);
    writeUint32LE(head, 0, 0x02014b50);
    writeUint16LE(head, 4, 20);
    writeUint16LE(head, 6, 20);
    writeUint16LE(head, 8, 0);
    writeUint16LE(head, 10, 0);
    writeUint16LE(head, 12, time);
    writeUint16LE(head, 14, date);
    writeUint32LE(head, 16, e.crc32);
    writeUint32LE(head, 20, e.size);
    writeUint32LE(head, 24, e.size);
    writeUint16LE(head, 28, nameBytes.length);
    writeUint16LE(head, 30, 0);
    writeUint16LE(head, 32, 0);
    writeUint16LE(head, 34, 0);
    writeUint16LE(head, 36, 0);
    writeUint32LE(head, 38, 0);
    writeUint32LE(head, 42, e.offset);
    head.set(nameBytes, 46);
    centralChunks.push(head);
    centralSize += head.length;
  }

  const eocd = new Uint8Array(22);
  writeUint32LE(eocd, 0, 0x06054b50);
  writeUint16LE(eocd, 4, 0);
  writeUint16LE(eocd, 6, 0);
  writeUint16LE(eocd, 8, entries.length);
  writeUint16LE(eocd, 10, entries.length);
  writeUint32LE(eocd, 12, centralSize);
  writeUint32LE(eocd, 16, cursor);
  writeUint16LE(eocd, 20, 0);

  // 拼接
  let total = cursor + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of localChunks) {
    out.set(c, off);
    off += c.length;
  }
  for (const c of centralChunks) {
    out.set(c, off);
    off += c.length;
  }
  out.set(eocd, off);
  return out;
}

export async function blobToUint8(blob: Blob): Promise<Uint8Array> {
  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf);
}

export function downloadBytes(name: string, bytes: Uint8Array, mime = "application/octet-stream") {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const blob = new Blob([ab], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
