export interface CommentNotification {
  commentId: string; visitId: string; groupId: string; body: string; stickerName: string | null;
  authorName: string; placeName: string; createdAt: string; readAt: string | null; own: boolean;
}
