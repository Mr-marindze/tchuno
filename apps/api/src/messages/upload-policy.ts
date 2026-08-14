import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export const MESSAGE_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const MESSAGE_ATTACHMENT_DEFAULT_EXPIRES_SECONDS = 300;
export const MESSAGE_ATTACHMENT_MIN_EXPIRES_SECONDS = 60;
export const MESSAGE_ATTACHMENT_MAX_EXPIRES_SECONDS = 600;

export const MESSAGE_ATTACHMENT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type MessageAttachmentMimeType =
  (typeof MESSAGE_ATTACHMENT_ALLOWED_MIME_TYPES)[number];

const extensionByMimeType: Record<MessageAttachmentMimeType, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
};

type UploadPolicyInput = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  expiresIn?: number;
  jobId: string;
  userId: string;
};

type AttachmentReferenceInput = {
  key: string;
  url: string;
  contentType: string;
  size: number;
  jobId: string;
  userId: string;
};

function assertSupportedContentType(
  contentType: string,
): asserts contentType is MessageAttachmentMimeType {
  if (
    !MESSAGE_ATTACHMENT_ALLOWED_MIME_TYPES.includes(
      contentType as MessageAttachmentMimeType,
    )
  ) {
    throw new BadRequestException('Unsupported attachment content type');
  }
}

function getExtension(fileName: string) {
  const trimmed = fileName.trim();
  if (
    trimmed.length === 0 ||
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    Array.from(trimmed).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 32 || codePoint === 127;
    })
  ) {
    throw new BadRequestException('Invalid attachment file name');
  }

  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    throw new BadRequestException('Attachment file extension is required');
  }

  return trimmed.slice(lastDot + 1).toLowerCase();
}

export function buildMessageAttachmentUpload(input: UploadPolicyInput) {
  assertSupportedContentType(input.contentType);

  if (
    !Number.isInteger(input.sizeBytes) ||
    input.sizeBytes < 1 ||
    input.sizeBytes > MESSAGE_ATTACHMENT_MAX_BYTES
  ) {
    throw new BadRequestException('Attachment size exceeds policy');
  }

  const extension = getExtension(input.fileName);
  const allowedExtensions = extensionByMimeType[input.contentType];
  if (!allowedExtensions.includes(extension)) {
    throw new BadRequestException(
      'Attachment extension does not match content type',
    );
  }

  const canonicalExtension =
    input.contentType === 'image/jpeg' ? 'jpg' : extension;
  const expiresIn =
    input.expiresIn ?? MESSAGE_ATTACHMENT_DEFAULT_EXPIRES_SECONDS;

  return {
    key: `uploads/messages/${input.userId}/${input.jobId}/${randomUUID()}.${canonicalExtension}`,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    maxSizeBytes: MESSAGE_ATTACHMENT_MAX_BYTES,
    expiresIn,
  };
}

export function validateMessageAttachmentReference(
  input: AttachmentReferenceInput,
) {
  assertSupportedContentType(input.contentType);

  if (
    !Number.isInteger(input.size) ||
    input.size < 1 ||
    input.size > MESSAGE_ATTACHMENT_MAX_BYTES
  ) {
    throw new BadRequestException('Attachment size exceeds policy');
  }

  const expectedPrefix = `uploads/messages/${input.userId}/${input.jobId}/`;
  if (!input.key.startsWith(expectedPrefix)) {
    throw new BadRequestException('Attachment key is not bound to this job');
  }

  const extension = input.key
    .slice(input.key.lastIndexOf('.') + 1)
    .toLowerCase();
  if (!extensionByMimeType[input.contentType].includes(extension)) {
    throw new BadRequestException(
      'Attachment key extension does not match content type',
    );
  }

  if (!/^https?:\/\//.test(input.url)) {
    throw new BadRequestException('Attachment URL must be absolute');
  }

  return {
    key: input.key,
    url: input.url,
    contentType: input.contentType,
    size: input.size,
  };
}
