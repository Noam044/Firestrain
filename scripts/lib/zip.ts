import { inflateRawSync } from "node:zlib";

/**
 * Reads one entry of a ZIP archive (stored or deflated, no ZIP64), enough for
 * the BDIFF export; avoids adding an archive dependency.
 */
export function readZipEntry(zip: Buffer, name: string): Buffer {
  // End of central directory: last occurrence of its signature.
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65_557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a ZIP archive (end of central directory not found)");

  const entries = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  const names: string[] = [];
  for (let e = 0; e < entries; e++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) throw new Error("corrupt ZIP central directory");
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const entryName = zip.toString("utf8", offset + 46, offset + 46 + nameLength);
    names.push(entryName);

    if (entryName === name) {
      if (zip.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("corrupt ZIP local header");
      const dataStart =
        localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
      const data = zip.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return inflateRawSync(data);
      throw new Error(`unsupported ZIP compression method ${method}`);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`"${name}" not found in archive (entries: ${names.join(", ")})`);
}
