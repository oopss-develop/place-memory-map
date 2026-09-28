import type { MarkerStyle } from "@/lib/marker-styles";

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
  ownerId?: string;
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
  isPlanned: boolean;
  title: string;
  note: string;
  rating: number;
  tags: string[];
  participants: Profile[];
  photoUrls: string[];
  markerStyle: MarkerStyle;
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

export interface Trip {
  id: string;
  groupId: string;
  name: string;
  startDate: string;
  endDate: string;
  timeZone: string;
  version: number;
}

export interface ScheduleItem {
  id: string;
  groupId: string;
  tripId: string;
  place: Place;
  startsAt: string;
  endsAt: string;
  title: string;
  note: string;
  markerStyle: MarkerStyle;
  version: number;
}

export interface TripRoute {
  kind: "road" | "straight";
  points: Array<{ latitude: number; longitude: number }>;
  distanceMeters?: number;
  durationSeconds?: number;
}

export interface MapPoint {
  id: string;
  place: Place;
  markerStyle: MarkerStyle;
  pinLabel?: string;
}
