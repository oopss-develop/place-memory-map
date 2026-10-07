import type { Visit } from "@/types/domain";

// This expiry is used only to avoid unnecessary image reloads, never for authorization.
function signedUrlExpiry(url: string): number {
  try {
    const token = new URL(url).searchParams.get("token");
    const payload = token?.split(".")[1];
    if (!payload) return 0;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    return typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export function preservePhotoUrls(current: Visit[], incoming: Visit[], now = Date.now()): Visit[] {
  const previousById = new Map(current.map(visit => [visit.id, visit]));
  return incoming.map(visit => {
    const previous = previousById.get(visit.id);
    if (!previous || previous.groupId !== visit.groupId) return visit;
    const urlsByPhotoId = new Map(previous.photoIds?.map((id, index) => [id, previous.photoUrls[index]]));
    const incomingById = new Map(visit.photoIds?.map((id,index) => [id,visit.photoUrls[index]]));
    if (visit.photoOrder) {
      const photos = visit.photoOrder.flatMap(id => {
        const previousUrl = urlsByPhotoId.get(id);
        const url = previousUrl && signedUrlExpiry(previousUrl) > now + 60_000 ? previousUrl : incomingById.get(id);
        return url ? [{ id, url }] : [];
      });
      return { ...visit, photoIds: photos.map(photo => photo.id), photoUrls: photos.map(photo => photo.url) };
    }
    return {
      ...visit,
      photoUrls: visit.photoUrls.map((url, index) => {
        const photoId = visit.photoIds?.[index];
        const previousUrl = photoId ? urlsByPhotoId.get(photoId) : undefined;
        return previousUrl && signedUrlExpiry(previousUrl) > now + 60_000 ? previousUrl : url;
      }),
    };
  });
}
