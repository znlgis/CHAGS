import type { Locale } from '../locale';
import enCaochong from './en/caochong-elephant.json';
import enPangu from './en/pangu.json';
import enHouyi from './en/houyi.json';
import enNuwa from './en/nuwa.json';
import enJingwei from './en/jingwei.json';
import enKuafu from './en/kuafu.json';
import enYugong from './en/yugong.json';
import enShennong from './en/shennong.json';
import enQiren from './en/qiren.json';
import enFenghuo from './en/fenghuo.json';
import enTaigong from './en/taigong.json';
import enDayu from './en/dayu.json';
import enKezhou from './en/kezhou.json';
import enZhaosanmusi from './en/zhaosanmusi.json';
import enJiaotu from './en/jiaotu.json';
import enYangyouji from './en/yangyouji.json';
import enPaoding from './en/paoding.json';
import enMantian from './en/mantian-guohai.json';
import enWeiwei from './en/weiwei-jiuzhao.json';
import enJiedao from './en/jiedao-sharen.json';
import enYiyi from './en/yiyi-dailao.json';
import enChenhuo from './en/chenhuo-dajie.json';
import enShengdong from './en/shengdong-jixi.json';
import enWuzhong from './en/wuzhong-shengyou.json';
import enAndu from './en/andu-chencang.json';
import enGean from './en/gean-guanhuo.json';
import enXiaoli from './en/xiaoli-cangdao.json';
import enLidai from './en/lidai-taojiang.json';
import enShunshou from './en/shunshou-qianyang.json';
import enDacao from './en/dacao-jingshe.json';
import enJieshi from './en/jieshi-huanhun.json';
import enDiaohu from './en/diaohu-lishan.json';
import enYuqin from './en/yuqin-guzong.json';
import enPaozhuan from './en/paozhuan-yinyu.json';
import enQinzei from './en/qinzei-qinwang.json';

/**
 * 典故内容的翻译补丁。结构镜像原文，只写需要翻译的字段。
 * 完整性（缺键、数组长度、译文超长）由 pnpm content:check 在构建期强制。
 */
export const patches: Partial<Record<Locale, Record<string, unknown>>> = {
  en: {
    'caochong-elephant': enCaochong,
    pangu: enPangu,
    houyi: enHouyi,
    nuwa: enNuwa,
    jingwei: enJingwei,
    kuafu: enKuafu,
    yugong: enYugong,
    shennong: enShennong,
    qiren: enQiren,
    fenghuo: enFenghuo,
    taigong: enTaigong,
    dayu: enDayu,
    kezhou: enKezhou,
    zhaosanmusi: enZhaosanmusi,
    jiaotu: enJiaotu,
    yangyouji: enYangyouji,
    paoding: enPaoding,
    'mantian-guohai': enMantian,
    'weiwei-jiuzhao': enWeiwei,
    'jiedao-sharen': enJiedao,
    'yiyi-dailao': enYiyi,
    'chenhuo-dajie': enChenhuo,
    'shengdong-jixi': enShengdong,
    'wuzhong-shengyou': enWuzhong,
    'andu-chencang': enAndu,
    'gean-guanhuo': enGean,
    'xiaoli-cangdao': enXiaoli,
    'lidai-taojiang': enLidai,
    'shunshou-qianyang': enShunshou,
    'dacao-jingshe': enDacao,
    'jieshi-huanhun': enJieshi,
    'diaohu-lishan': enDiaohu,
    'yuqin-guzong': enYuqin,
    'paozhuan-yinyu': enPaozhuan,
    'qinzei-qinwang': enQinzei,
  },
};

export function patchFor(locale: Locale, id: string): unknown {
  return patches[locale]?.[id];
}
