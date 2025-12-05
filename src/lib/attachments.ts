/**
 * Attachment Utilities
 *
 * Handles file validation, type detection, and content extraction
 * for the Attach feature. Supports images, PDFs, and text files.
 *
 * @module lib/attachments
 */

import type { Attachment, AttachmentType } from '@/types'
import { EXTENSION_TO_TYPE, SUPPORTED_EXTENSIONS } from '@/types'

// Re-export for convenience
export { SUPPORTED_EXTENSIONS }

// ============================================================
// CONSTANTS
// ============================================================

/** Maximum file size in bytes (20MB for images/PDFs, matching OpenRouter limit) */
export const MAX_FILE_SIZE = 20 * 1024 * 1024

/** Maximum number of attachments per query */
export const MAX_ATTACHMENTS = 4

/** Extensions grouped by category for display */
export const EXTENSION_GROUPS = {
  images: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  documents: ['pdf', 'txt', 'md', 'csv'],
  code: ['js', 'jsx', 'ts', 'tsx', 'py', 'html', 'css', 'json', 'xml', 'yaml', 'yml'],
}

// ============================================================
// VALIDATION
// ============================================================

/**
 * Result of file validation.
 */
export interface ValidationResult {
  valid: boolean
  error?: string
  type?: AttachmentType
}

/**
 * Gets the file extension from a filename (lowercase, no dot).
 */
export function getExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

/**
 * Validates a file and determines its attachment type.
 *
 * @param file - File to validate
 * @returns Validation result with type if valid
 *
 * @example
 * const result = validateFile(file)
 * if (!result.valid) {
 *   showError(result.error)
 * }
 */
export function validateFile(file: File): ValidationResult {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1)
    return {
      valid: false,
      error: `File too large (${sizeMB}MB). Maximum is 20MB.`,
    }
  }

  // Check extension
  const ext = getExtension(file.name)
  if (!ext) {
    return {
      valid: false,
      error: `File has no extension. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`,
    }
  }

  const type = EXTENSION_TO_TYPE[ext]
  if (!type) {
    return {
      valid: false,
      error: `Unsupported file type (.${ext}). Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`,
    }
  }

  return { valid: true, type }
}

// ============================================================
// FILE READING
// ============================================================

/**
 * Reads a file and creates an Attachment object.
 *
 * - Images and PDFs: read as base64
 * - Text files: read as UTF-8 text
 *
 * @param file - File to read
 * @returns Promise resolving to Attachment or null if invalid
 *
 * @example
 * const attachment = await readFile(file)
 * if (attachment) {
 *   setAttachments([...attachments, attachment])
 * }
 */
export async function readFile(file: File): Promise<Attachment | null> {
  const validation = validateFile(file)
  if (!validation.valid || !validation.type) {
    return null
  }

  const type = validation.type

  try {
    let content: string

    if (type === 'text') {
      // Read as text
      content = await file.text()
    } else {
      // Read as base64 (images and PDFs)
      // Use FileReader to handle large files properly
      content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          // Result is data URL like "data:image/png;base64,ABC123..."
          // We just want the base64 part after the comma
          const result = reader.result as string
          const base64 = result.split(',')[1]
          resolve(base64)
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
    }

    return {
      name: file.name,
      type,
      mimeType: file.type || getMimeType(file.name),
      content,
      size: file.size,
    }
  } catch (error) {
    console.error('Error reading file:', error)
    return null
  }
}

/**
 * Reads multiple files, filtering out invalid ones.
 *
 * @param files - FileList from input element
 * @param existing - Already attached files (to check limit)
 * @returns Object with successful attachments and any errors
 */
export async function readFiles(
  files: FileList,
  existing: Attachment[] = []
): Promise<{ attachments: Attachment[]; errors: string[] }> {
  const errors: string[] = []
  const attachments: Attachment[] = []

  const remainingSlots = MAX_ATTACHMENTS - existing.length
  const filesToProcess = Array.from(files).slice(0, remainingSlots)

  if (files.length > remainingSlots) {
    errors.push(`Only ${remainingSlots} more file(s) allowed (max ${MAX_ATTACHMENTS})`)
  }

  for (const file of filesToProcess) {
    const validation = validateFile(file)
    if (!validation.valid) {
      errors.push(`${file.name}: ${validation.error}`)
      continue
    }

    const attachment = await readFile(file)
    if (attachment) {
      attachments.push(attachment)
    } else {
      errors.push(`${file.name}: Failed to read file`)
    }
  }

  return { attachments, errors }
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Gets MIME type from filename if File.type is empty.
 * (Some browsers don't set type for certain files)
 */
function getMimeType(filename: string): string {
  const ext = getExtension(filename)
  const mimeMap: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    // PDF
    pdf: 'application/pdf',
    // Text
    txt: 'text/plain',
    md: 'text/markdown',
    markdown: 'text/markdown',
    csv: 'text/csv',
    json: 'application/json',
    js: 'text/javascript',
    jsx: 'text/javascript',
    ts: 'text/typescript',
    tsx: 'text/typescript',
    py: 'text/x-python',
    html: 'text/html',
    htm: 'text/html',
    css: 'text/css',
    xml: 'text/xml',
    yaml: 'text/yaml',
    yml: 'text/yaml',
  }
  return mimeMap[ext] || 'application/octet-stream'
}

/**
 * Formats file size for display.
 *
 * @example
 * formatSize(1024) // "1.0 KB"
 * formatSize(1048576) // "1.0 MB"
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Gets an icon for the attachment type.
 */
export function getAttachmentIcon(type: AttachmentType): string {
  switch (type) {
    case 'image':
      return '🖼️'
    case 'pdf':
      return '📄'
    case 'text':
      return '📝'
    default:
      return '📎'
  }
}

/**
 * Creates a preview URL for an image attachment.
 * Returns null for non-image types.
 */
export function createPreviewUrl(attachment: Attachment): string | null {
  if (attachment.type !== 'image') return null
  return `data:${attachment.mimeType};base64,${attachment.content}`
}
