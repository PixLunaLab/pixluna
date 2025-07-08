export function detectMimeType(buffer: ArrayBuffer): string {
  const arr = new Uint8Array(buffer).subarray(0, 4)
  let header = ''
  for (let i = 0; i < arr.length; i++) {
    header += arr[i].toString(16)
  }

  switch (header) {
    case '89504e47':
      return 'image/png'
    case 'ffd8ffe0':
    case 'ffd8ffe1':
    case 'ffd8ffe2':
      return 'image/jpeg'
    case '47494638':
      return 'image/gif'
    default:
      return 'application/octet-stream'
  }
}
