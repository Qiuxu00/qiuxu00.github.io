import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { optimizePhoto } from '../scripts/optimize-photo.mjs';

async function withOutput(run) {
  const parent = path.resolve(tmpdir());
  const directory = await mkdtemp(path.join(parent, 'homepage-photo-test-'));
  try {
    await run(directory);
  } finally {
    const target = path.resolve(directory);
    assert.equal(path.dirname(target), parent);
    assert.ok(path.basename(target).startsWith('homepage-photo-test-'));
    await rm(target, { recursive: true, force: true });
  }
}

test('avatar derivatives retain the full composition and original bytes at responsive sizes', () => withOutput(async out => {
  const original = await sharp({ create: { width: 1800, height: 1200, channels: 4, background: '#aabbcc80' } })
    .png().toBuffer();
  const untouched = Buffer.from(original);
  const result = await optimizePhoto(original, out);
  assert.deepEqual(original, untouched);
  assert.equal(result.originalWidth, 1800);
  assert.equal(result.originalHeight, 1200);
  assert.deepEqual(result.candidates.map(({ width, height }) => [width, height]), [[480, 320], [960, 640], [1440, 960]]);
  assert.equal(result.src, result.candidates[1].src);
  for (const candidate of result.candidates) {
    const bytes = await readFile(path.join(out, candidate.src));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.width, candidate.width);
    assert.equal(metadata.height, candidate.height);
    assert.equal(metadata.hasAlpha, true);
    assert.equal(bytes.length, candidate.bytes);
  }
}));

test('small images are never enlarged and replaced pixels get a different URL', () => withOutput(async out => {
  const make = background => sharp({ create: { width: 32, height: 20, channels: 3, background } }).png().toBuffer();
  const original = await make('#ff0000');
  const first = await optimizePhoto(original, out);
  assert.deepEqual(first.candidates.map(({ width, height }) => [width, height]), [[32, 20]]);
  assert.equal(first.src, first.candidates[0].src);
  const repeated = await optimizePhoto(original, out);
  assert.deepEqual(repeated, first);
  const replacement = await optimizePhoto(await make('#0000ff'), out);
  assert.notEqual(first.src, replacement.src);
}));

test('EXIF orientation is applied before sizing without keeping orientation metadata', () => withOutput(async out => {
  const original = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#405060' } })
    .withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const result = await optimizePhoto(original, out);
  assert.equal(result.originalWidth, 800);
  assert.equal(result.originalHeight, 1200);
  assert.deepEqual(result.candidates.map(({ width, height }) => [width, height]), [[480, 720], [800, 1200]]);
  const output = await sharp(await readFile(path.join(out, result.src))).metadata();
  assert.equal(output.orientation, undefined);
  assert.equal(output.exif, undefined);
  assert.equal((await sharp(original).metadata()).orientation, 6);
}));

test('unsupported and animated uploads keep their original instead of being flattened', () => withOutput(async out => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="20"/>');
  assert.equal(await optimizePhoto(svg, out), null);
  const animatedWebP = await sharp(Buffer.from([
    255, 0, 0, 255, 0, 0,
    0, 0, 255, 0, 0, 255
  ]), { raw: { width: 2, height: 2, channels: 3, pageHeight: 1 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
  assert.equal((await sharp(animatedWebP).metadata()).pages, 2);
  assert.equal(await optimizePhoto(animatedWebP, out), null);
  // The animation-control chunk marks APNG even where libvips reports one page.
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#000000' } }).png().toBuffer();
  const animationControl = Buffer.from('000000086163544c0000000200000000f38d9370', 'hex');
  const apng = Buffer.concat([png.subarray(0, 33), animationControl, png.subarray(33)]);
  assert.equal(await optimizePhoto(apng, out), null);
  assert.deepEqual(await readdir(out), []);
}));

test('damaged recognized images fail with an actionable upload message', () => withOutput(async out => {
  const damaged = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
  await assert.rejects(optimizePhoto(damaged, out), /Re-export it as a JPEG, PNG, or WebP image and upload it again/);
}));
