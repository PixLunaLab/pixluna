import type { Context } from 'koishi'
import type { Config } from '../config'

export type ImageMimeType = 'jpg' | 'jpeg' | 'png' | 'gif'

export interface ImageMetaData {
    url: string
    urls: {
        regular?: string
        original?: string
    }
    raw: GeneralImageData
}

export interface GeneralImageData {
    id: number | string
    title: string
    author: string
    r18: boolean
    tags: string[]
    extension: string
    aiType: number
    uploadDate: number
    urls: {
        regular?: string
        original: string
    }
}

export interface CommonSourceRequest {
    tag?: string
    size?: string[]
    r18?: boolean
    excludeAI?: boolean
    proxy?: string
}

export interface CommonSourceResponse {
    image: ArrayBuffer
    metaData: ImageMetaData
}

export type SourceResponseStatus = 'success' | 'error'
export type SourceResponse<
    T,
    U extends SourceResponseStatus = SourceResponseStatus
> = U extends 'success'
    ? {
          status: U
          data: T
      }
    : U extends 'error'
      ? {
            status: U
            data: Error | string | null | undefined
        }
      : {
            status: SourceResponseStatus
            data: any
        }

export interface ImageSourceMeta {
    referer?: string
}

export abstract class SourceProvider {
    static description: string

    protected config: Config
    protected ctx: Context

    constructor(ctx: Context, config: Config) {
        this.ctx = ctx
        this.config = config
    }

    abstract getMetaData(
        props: { context: Context },
        request: CommonSourceRequest
    ): Promise<SourceResponse<ImageMetaData>>

    abstract setConfig(config: Config): void

    abstract getMeta(): ImageSourceMeta
}
