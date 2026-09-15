# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated and confirmed in the implementation plan: Next.js App Router with TypeScript and Tailwind CSS, deployed to Vercel Hobby with Supabase Free for authentication, Postgres, and private image storage. Kakao Maps provides the Korea-first map and place search.

## Users

Couples and small private groups who want to remember places they visited together. They use the product primarily on phones while out and on desktop when revisiting or organizing memories.

## Product Purpose

Place Memory Map turns shared place visits into a private, editable map journal. Success means a signed-in member can find or pin a place, attach a dated memory with companions and photos, and every member of the same group can see and maintain it without exposing it to outsiders.

## Positioning

The durable unit is a revisitable place with a shared visit history, not an itinerary, public review, or social post.

## Operating Context

Members switch between private groups, search Korean businesses through Kakao, add manual coordinates when a place is unavailable, and browse the collective history from a map or chronological list.

## Capabilities and Constraints

- Email magic-link authentication and invitation links that expire after seven days.
- Multiple groups per user; owners manage invitations and membership.
- All current group members can collaboratively create and edit visits.
- Visits include date, title, note, participants, rating, tags, and up to five photos.
- Places may have multiple visits. Deletion is recoverable for 30 days.
- Korea-first Kakao place search; overseas places use manual pins in v1.
- Personal, non-commercial use within Vercel, Supabase, Kakao, and Brevo free tiers.
- Itineraries, comments, public sharing, route finding, and overseas business search are out of scope.

## Brand Commitments

Product name: Place Memory Map. Korean is the primary interface language. The experience must feel like a considered travel field notebook and must not resemble generic AI-generated dashboard UI.

## Evidence on Hand

No user-supplied photography, logo, or production data is available. Demonstration records must be clearly synthetic and no testimonials or usage claims may be invented.

## Product Principles

- The map and the memories begin in the first viewport.
- Shared history stays private by default and authorization lives in the database.
- Recording a visit must remain possible when Kakao search is unavailable.
- Places accumulate visits rather than being duplicated.
- Small personal use must remain functional without paid infrastructure.

## Accessibility & Inclusion

All core pin information must also be reachable through a keyboard-accessible list. Controls must work by touch and keyboard, maintain visible focus, and remain usable at 200% text zoom.
