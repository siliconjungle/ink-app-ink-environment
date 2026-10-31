import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Remap diagnostic strings in custom/data sections without changing their byte
// lengths, memory offsets, exports or executable sections.
export function sanitizeWasmPaths(input) {
  const bytes = Buffer.from(input);
  if (!WebAssembly.validate(bytes)) throw Error('Expected a valid WebAssembly module');
  let cursor = 8, replacements = 0;
  function leb() {
    let value = 0, shift = 0, next;
    do { if (cursor >= bytes.length || shift > 28) throw Error('Invalid section size'); next = bytes[cursor++]; value += (next & 127) * 2 ** shift; shift += 7; } while (next & 128);
    return value;
  }
  while (cursor < bytes.length) {
    const section = bytes[cursor++], size = leb(), end = cursor + size;
    if (end > bytes.length) throw Error('Invalid section boundary');
    const payload = bytes.subarray(cursor, end).toString('latin1');
    const clean = payload.replace(/\/(?:Users|home)\/[^/\x00\s]+\/(?:Documents\/(?:[^/\x00\s]+\/){2})?/g, value => {
      if (section !== 0 && section !== 11) throw Error('A source path occurs outside diagnostic/data sections');
      replacements++;
      return '/src/' + '_'.repeat(value.length - 6) + '/';
    });
    if (clean.length !== payload.length) throw Error('Path remapping changed section length');
    bytes.write(clean, cursor, size, 'latin1');
    cursor = end;
  }
  if (!WebAssembly.validate(bytes)) throw Error('Remapped module failed validation');
  return { bytes, replacements };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const path of process.argv.slice(2)) {
    const result = sanitizeWasmPaths(await readFile(path));
    await writeFile(path, result.bytes);
    console.log(path + ': remapped ' + result.replacements + ' diagnostic roots');
  }
}
