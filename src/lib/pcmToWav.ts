/** Wrap 16-bit little-endian PCM in a WAV container for browser playback. */
export function pcm16ToWav(
  pcm: Buffer,
  sampleRate = 24000,
  channels = 1
): Buffer {
  const byteRate = sampleRate * channels * 2;
  const blockAlign = channels * 2;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export function parsePcmSampleRate(mimeType: string): number {
  const m = mimeType.match(/rate=(\d+)/i);
  return m ? parseInt(m[1], 10) : 24000;
}
