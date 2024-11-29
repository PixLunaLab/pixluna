import { BaseLoliconProvider } from './base'

export class LoliconSourceProvider extends BaseLoliconProvider {
    static description = '通过 Lolicon API 获取图片'
    protected RANDOM_IMAGE_URL = 'https://api.lolicon.app/setu/v2'
}
