import { fileTypeFromBuffer } from 'file-type'

export async function detectMimeType(buffer: ArrayBuffer): Promise<string> {
  try {
    const result = await fileTypeFromBuffer(Buffer.from(buffer))
    return result?.mime ?? 'application/octet-stream'
  } catch {
    return 'application/octet-stream'
  }
}
