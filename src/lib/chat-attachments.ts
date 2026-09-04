export const MAX_CHAT_IMAGE_ATTACHMENTS = 2;
export const MAX_CHAT_IMAGE_BYTES = 4 * 1024 * 1024;
export const CHAT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const CHAT_IMAGE_BLOB_ACCESS = "public" as const;

export type ChatImageType = (typeof CHAT_IMAGE_TYPES)[number];

export type ChatImageAttachment = {
  id: string;
  assetId: string;
  url: string;
  contentType: ChatImageType;
  width?: number | null;
  height?: number | null;
  name?: string | null;
};

export type LookbookImage = ChatImageAttachment & {
  lookbookId: string;
  title: string;
  notes?: string | null;
};
