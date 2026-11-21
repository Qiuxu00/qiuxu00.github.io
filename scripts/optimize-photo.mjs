import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const WIDTHS = [480, 960, 1440];
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function rasterFormat(bytes) {
  if (bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return '';
}

// libvips does not expose APNG animation metadata on every platform. Inspect
// container chunks as well, so an animated upload can never become a still.
function isAnimated(bytes, format) {
  if (format === 'png') {
    for (let offset = 8; offset + 8 <= bytes.length;) {
      const type = bytes.toString('ascii', offset + 4, offset + 8);
      if (type === 'acTL') return true;
      const length = bytes.readUInt32BE(offset);
      if (length > bytes.length - offset - 12) break;
      offset += length + 12;
    }
  }
  if (format === 'webp') {
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const type = bytes.toString('ascii', offset, offset + 4);
      if (type === 'ANIM' || type === 'ANMF') return true;
      const length = bytes.readUInt32LE(offset + 4);
      if (length > bytes.length - offset - 8) break;
      offset += 8 + length + (length % 2);
    }
  }
  return false;
}

/**
 * Create responsive WebP files without changing the source image or cropping.
 * All paths in the result are relative to the published site root. Other
 * formats and animations return null and keep using the uploaded original.
 */
export async function optimizePhoto(photoBytes, outDir) {
  if (!(photoBytes instanceof Uint8Array)) throw new TypeError('Avatar input must contain image bytes.');
  const bytes = Buffer.isBuffer(photoBytes) ? photoBytes : Buffer.from(photoBytes);
  const format = rasterFormat(bytes);
  if (!format || isAnimated(bytes, format)) return null;

  let metadata;
  try {
    metadata = await sharp(bytes).metadata();
  } catch (cause) {
    throw new Error('The avatar image could not be read. Re-export it as a JPEG, PNG, or WebP image and upload it again.', { cause });
  }
  if ((metadata.pages || 1) > 1) return null;
  const swapsAxes = metadata.orientation >= 5 && metadata.orientation <= 8;
  const originalWidth = swapsAxes ? metadata.height : metadata.width;
  const originalHeight = swapsAxes ? metadata.width : metadata.height;
  const widths = [...new Set(WIDTHS.map(width => Math.min(width, originalWidth)))];
  const candidates = [];
  const directory = path.join(outDir, 'assets', 'generated');
  await mkdir(directory, { recursive: true });

  for (const width of widths) {
    let output;
    try {
      output = await sharp(bytes).autoOrient()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toBuffer({ resolveWithObject: true });
    } catch (cause) {
      throw new Error('The avatar image could not be resized. Re-export it as a JPEG, PNG, or WebP image and upload it again.', { cause });
    }
    const hash = createHash('sha256').update(output.data).digest('hex').slice(0, 20);
    const filename = `avatar-${output.info.width}-${hash}.webp`;
    await writeFile(path.join(directory, filename), output.data);
    candidates.push({
      src: `assets/generated/${filename}`,
      width: output.info.width,
      height: output.info.height,
      bytes: output.data.length
    });
  }
  const preferred = candidates.findLast(candidate => candidate.width <= 960) || candidates[0];
  return { src: preferred.src, candidates, originalWidth, originalHeight };
}
