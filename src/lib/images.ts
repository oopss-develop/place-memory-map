export const MAX_VISIT_IMAGE_BYTES = 350_000;
const MAX_VISIT_IMAGE_MB = MAX_VISIT_IMAGE_BYTES / 1_000_000;

export async function prepareVisitImage(file: File) {
  let source = file;
  if (/heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.78 });
    source = new File([Array.isArray(converted) ? converted[0] : converted], `${file.name}.jpg`, { type: "image/jpeg" });
  }
  const { default: imageCompression } = await import("browser-image-compression");
  const compressed = await imageCompression(source, {
    maxSizeMB: MAX_VISIT_IMAGE_MB,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.72,
    maxIteration: 12,
  });
  return new File([compressed], `${crypto.randomUUID()}.webp`, { type: "image/webp" });
}
