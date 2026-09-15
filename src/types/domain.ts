export type MemberRole = "owner" | "member";
export type PlaceProvider = "kakao" | "manual";

export interface Profile {
  id: string;
  displayName: string;
  initials: string;
}

export interface Group {
  id: string;
  name: string;
  role: MemberRole;
  memberCount: number;
}

export interface Place {
  id: string;
  provider: PlaceProvider;
  providerPlaceId?: string;
  name: string;
  address: string;
  category: string;
  latitude: number;
  longitude: number;
}

export interface Visit {
  id: string;
  groupId: string;
  place: Place;
  visitedOn: string;
  title: string;
  note: string;
  rating: number;
  tags: string[];
  participants: Profile[];
  photoUrls: string[];
  version: number;
  deletedAt?: string | null;
  updatedBy: string;
}

export interface KakaoPlaceResult {
  id: string;
  placeName: string;
  addressName: string;
  roadAddressName: string;
  categoryName: string;
  latitude: number;
  longitude: number;
}
