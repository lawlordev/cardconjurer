const test = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {createServer} = require('node:http');
const {mkdtempSync, readFileSync, rmSync, writeFileSync} = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const JSZip = require('jszip');
const {downloadArchive, extractArchive} = require('../../dist/desktop/services/pack-archive.js');

test('pack archive resumes to disk and extracts without buffering the ZIP', async (context) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'set-conjurer-pack-test-'));
  context.after(() => rmSync(root, {recursive: true, force: true}));
  const zip = new JSZip();
  zip.file('img/frames/Test/frame.png', Buffer.alloc(96 * 1024, 7));
  const payload = await zip.generateAsync({type: 'nodebuffer', compression: 'DEFLATE'});
  const digest = createHash('sha256').update(payload).digest('hex');
  let requestedRange = null;
  const server = createServer((request, response) => {
    requestedRange = request.headers.range || null;
    const offset = requestedRange ? Number(requestedRange.match(/bytes=(\d+)-/)[1]) : 0;
    response.writeHead(offset ? 206 : 200, {
      'content-length': payload.length - offset,
      ...(offset ? {'content-range': `bytes ${offset}-${payload.length - 1}/${payload.length}`} : {})
    });
    response.end(payload.subarray(offset));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => server.close());

  const archivePath = path.join(root, 'pack.zip');
  const partialBytes = Math.floor(payload.length / 3);
  writeFileSync(`${archivePath}.partial`, payload.subarray(0, partialBytes));
  const progress = [];
  await downloadArchive({url: `http://127.0.0.1:${server.address().port}/pack.zip`, sha256: digest, archiveBytes: payload.length}, archivePath, {
    maxBytes: 1024 * 1024,
    onProgress: (value) => progress.push(value.receivedBytes)
  });
  assert.equal(requestedRange, `bytes=${partialBytes}-`);
  assert.deepEqual(readFileSync(archivePath), payload);
  assert.ok(progress.every((value, index) => index === 0 || value >= progress[index - 1]));

  requestedRange = 'not-called';
  await downloadArchive({url: `http://127.0.0.1:${server.address().port}/pack.zip`, sha256: digest, archiveBytes: payload.length}, archivePath, {
    maxBytes: 1024 * 1024,
    onProgress: () => {}
  });
  assert.equal(requestedRange, 'not-called', 'a verified archive should be reused after an extraction retry');

  const destination = path.join(root, 'expanded');
  const limits = {maxExpandedBytes: 1024 * 1024, maxFiles: 10, expandedBytes: 0, files: 0};
  await extractArchive(archivePath, destination, limits, () => {});
  assert.equal(readFileSync(path.join(destination, 'img/frames/Test/frame.png')).length, 96 * 1024);
  assert.equal(limits.files, 1);
});

test('pack archive rejects traversal entries', async (context) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'set-conjurer-pack-unsafe-'));
  context.after(() => rmSync(root, {recursive: true, force: true}));
  const zip = new JSZip();
  zip.file('../outside.txt', 'no');
  const archivePath = path.join(root, 'unsafe.zip');
  writeFileSync(archivePath, await zip.generateAsync({type: 'nodebuffer'}));
  await assert.rejects(
    extractArchive(archivePath, path.join(root, 'expanded'), {maxExpandedBytes: 1024, maxFiles: 5, expandedBytes: 0, files: 0}, () => {}),
    /outside its install directory|invalid relative path/
  );
});
