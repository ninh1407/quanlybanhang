export type AttachmentValidationResult =
  | { ok: true; files: File[] }
  | { ok: false; error: string }

const DEFAULT_MAX_FILE_BYTES = 5 * 1024 * 1024
const DEFAULT_MAX_FILES = 10

function isAllowedType(file: File): boolean {
  if (file.type === 'application/pdf') return true
  if (file.type.startsWith('image/')) return true
  return false
}

export function validateAttachmentFiles(
  files: FileList | File[] | null,
  opts?: { maxFiles?: number; maxFileBytes?: number },
): AttachmentValidationResult {
  if (!files || files.length === 0) return { ok: true, files: [] }
  const maxFiles = Math.max(1, opts?.maxFiles ?? DEFAULT_MAX_FILES)
  const maxFileBytes = Math.max(1024, opts?.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES)

  const list = Array.from(files)
  if (list.length > maxFiles) {
    return { ok: false, error: `Chỉ cho phép tối đa ${maxFiles} file mỗi lần.` }
  }

  for (const f of list) {
    if (!isAllowedType(f)) {
      return { ok: false, error: `File "${f.name}" không đúng định dạng. Chỉ hỗ trợ JPG/PNG/WebP và PDF.` }
    }
    if (f.size > maxFileBytes) {
      return { ok: false, error: `File "${f.name}" quá lớn. Tối đa ${Math.round(maxFileBytes / (1024 * 1024))}MB.` }
    }
  }

  return { ok: true, files: list }
}

