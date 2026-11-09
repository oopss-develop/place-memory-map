export const MAX_VISIT_IMAGE_BYTES = 350_000;
// browser-image-compression treats maxSizeMB as MiB (1024 * 1024 bytes), and it can stop
// slightly above its target. Aim well below the server limit so the result always fits.
const COMPRESSION_TARGET_MB = (MAX_VISIT_IMAGE_BYTES * 0.85) / (1024 * 1024);
// Try smaller dimensions when a detailed photo still exceeds the limit at the larger size.
const COMPRESSION_ATTEMPTS = [
  { maxWidthOrHeight: 1280, initialQuality: 0.72 },
  { maxWidthOrHeight: 1024, initialQuality: 0.68 },
  { maxWidthOrHeight: 800, initialQuality: 0.62 },
];

export async function prepareVisitImage(file: File) {
  let source = file;
  if (/heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.78 });
    source = new File([Array.isArray(converted) ? converted[0] : converted], `${file.name}.jpg`, { type: "image/jpeg" });
  }
  const { default: imageCompression } = await import("browser-image-compression");
  for (const attempt of COMPRESSION_ATTEMPTS) {
    const compressed = await imageCompression(source, {
      ...attempt,
      maxSizeMB: COMPRESSION_TARGET_MB,
      useWebWorker: true,
      fileType: "image/webp",
      maxIteration: 12,
    });
    if (compressed.size <= MAX_VISIT_IMAGE_BYTES) {
      return new File([compressed], `${crypto.randomUUID()}.webp`, { type: "image/webp" });
    }
  }
  throw new Error("사진을 충분히 줄이지 못했어요. 더 작은 사진으로 다시 시도해 주세요.");
}
