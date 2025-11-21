import { webcrypto } from 'node:crypto'

export function shuffleArray<T>(array: T[]): T[] {
  if (array.length <= 1) {
    return [...array]
  }

  const shuffled = [...array]

  const randomBuffer = new Uint32Array(shuffled.length)
  webcrypto.getRandomValues(randomBuffer)

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomBuffer[i] % (i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return shuffled
}
