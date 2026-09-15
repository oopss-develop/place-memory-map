export async function prepareVisitImage(file: File) {
  let source = file;
  if (/heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.88 });
    source = new File([Array.isArray(converted) ? converted[0] : converted], `${file.name}.jpg`, { type: "image/jpeg" });
  }
  const { default: imageCompression } = await import("browser-image-compression");
  const compressed = await imageCompression(source, {
    maxSizeMB: 1.5,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.86,
  });
  return new File([compressed], `${crypto.randomUUID()}.webp`, { type: "image/webp" });
}
