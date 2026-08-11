import { crc32 } from "node:zlib";

/**
 * Deterministic ZIP construction for publication artifacts (Phase 3
 * WP-36). Every entry is STORED (method 0, uncompressed): compression
 * codecs vary across zlib versions, and a publication artifact's bytes
 * must not depend on the runtime that produced them. Book-length text
 * makes the size cost immaterial; determinism is the requirement.
 *
 * Fixed by construction: entry order (insertion order), timestamps
 * (1980-01-01 00:00:00, the DOS epoch), no extra fields, no comments,
 * no platform attributes, ASCII names only. Same entries in, same
 * bytes out — always. This also satisfies the EPUB OCF requirement
 * that `mimetype` be first and uncompressed when it is added first.
 */

const DOS_EPOCH_TIME = 0x0000; // 00:00:00
const DOS_EPOCH_DATE = 0x0021; // 1980-01-01

export interface ZipEntryInput {
  /** Forward-slash path; ASCII only (enforced). */
  name: string;
  data: Buffer;
}

function u16(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
}

function u32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
}

export function buildDeterministicZip(entries: ZipEntryInput[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    if (!/^[\x20-\x7e]+$/.test(entry.name)) {
      throw new Error(`Zip entry name must be printable ASCII: ${entry.name}`);
    }
    const name = Buffer.from(entry.name, "ascii");
    const crc = crc32(entry.data) >>> 0;
    const size = entry.data.length;

    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20), // version needed
      u16(0), // flags
      u16(0), // method: stored
      u16(DOS_EPOCH_TIME),
      u16(DOS_EPOCH_DATE),
      u32(crc),
      u32(size),
      u32(size),
      u16(name.length),
      u16(0), // extra length
      name,
      entry.data,
    ]);

    centralParts.push(
      Buffer.concat([
        u32(0x02014b50),
        u16(20), // version made by (DOS, so external attrs stay zero)
        u16(20), // version needed
        u16(0),
        u16(0),
        u16(DOS_EPOCH_TIME),
        u16(DOS_EPOCH_DATE),
        u32(crc),
        u32(size),
        u32(size),
        u16(name.length),
        u16(0), // extra
        u16(0), // comment
        u16(0), // disk number
        u16(0), // internal attrs
        u32(0), // external attrs
        u32(offset),
        name,
      ]),
    );

    localParts.push(local);
    offset += local.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDirectory.length),
    u32(offset),
    u16(0), // comment length
  ]);

  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

export interface ZipEntryRead {
  name: string;
  method: number;
  data: Buffer;
}

/** Minimal reader for stored-and-deflate-free archives — used by the
 *  structural validator to inspect exactly what was packaged. */
export function readZipEntries(zip: Buffer): ZipEntryRead[] {
  const entries: ZipEntryRead[] = [];
  let pos = 0;
  while (pos + 4 <= zip.length && zip.readUInt32LE(pos) === 0x04034b50) {
    const method = zip.readUInt16LE(pos + 8);
    const size = zip.readUInt32LE(pos + 18);
    const nameLength = zip.readUInt16LE(pos + 26);
    const extraLength = zip.readUInt16LE(pos + 28);
    const name = zip
      .subarray(pos + 30, pos + 30 + nameLength)
      .toString("ascii");
    const dataStart = pos + 30 + nameLength + extraLength;
    entries.push({
      name,
      method,
      data: zip.subarray(dataStart, dataStart + size),
    });
    pos = dataStart + size;
  }
  return entries;
}
