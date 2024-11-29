import { BaseLoliconProvider } from './base'

export class LolisukiSourceProvider extends BaseLoliconProvider {
    static description = '通过 Lolisuki API 获取图片'
    protected RANDOM_IMAGE_URL = 'https://lolisuki.cn/api/setu/v1'
}
