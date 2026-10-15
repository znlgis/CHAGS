import type { Locale } from '../locale';
import enCaochongGame from './en/caochong-elephant.game.json';
import enPanguGame from './en/pangu.game.json';
import enHouyiGame from './en/houyi.game.json';
import enNuwaGame from './en/nuwa.game.json';
import enJingweiGame from './en/jingwei.game.json';
import enKuafuGame from './en/kuafu.game.json';
import enYugongGame from './en/yugong.game.json';
import enShennongGame from './en/shennong.game.json';
import enQirenGame from './en/qiren.game.json';
import enFenghuoGame from './en/fenghuo.game.json';
import enTaigongGame from './en/taigong.game.json';
import enDayuGame from './en/dayu.game.json';
import enKezhouGame from './en/kezhou.game.json';
import enZhaosanmusiGame from './en/zhaosanmusi.game.json';
import enJiaotuGame from './en/jiaotu.game.json';
import enYangyoujiGame from './en/yangyouji.game.json';
import enPaodingGame from './en/paoding.game.json';
import enMantianGame from './en/mantian-guohai.game.json';
import enWeiweiGame from './en/weiwei-jiuzhao.game.json';
import enJiedaoGame from './en/jiedao-sharen.game.json';
import enYiyiGame from './en/yiyi-dailao.game.json';
import enChenhuoGame from './en/chenhuo-dajie.game.json';
import enShengdongGame from './en/shengdong-jixi.game.json';
import enWuzhongGame from './en/wuzhong-shengyou.game.json';
import enAnduGame from './en/andu-chencang.game.json';
import enGeanGame from './en/gean-guanhuo.game.json';
import enXiaoliGame from './en/xiaoli-cangdao.game.json';
import enLidaiGame from './en/lidai-taojiang.game.json';
import enShunshouGame from './en/shunshou-qianyang.game.json';
import enDacaoGame from './en/dacao-jingshe.game.json';
import enJieshiGame from './en/jieshi-huanhun.game.json';
import enDiaohuGame from './en/diaohu-lishan.game.json';
import enYuqinGame from './en/yuqin-guzong.game.json';
import enPaozhuanGame from './en/paozhuan-yinyu.game.json';
import enQinzeiGame from './en/qinzei-qinwang.game.json';
import enFudiGame from './en/fudi-chouxin.game.json';
import enHunshuiGame from './en/hunshui-moyu.game.json';
import enJinchanGame from './en/jinchan-tuoqiao.game.json';
import enGuanmenGame from './en/guanmen-zhuozei.game.json';
import enYuanjiaoGame from './en/yuanjiao-jingong.game.json';
import enJiadaoGame from './en/jiadao-faguo.game.json';
import enTouliangGame from './en/touliang-huanzhu.game.json';
import enZhisangGame from './en/zhisang-mahuai.game.json';
import enJiachiGame from './en/jiachi-budian.game.json';
import enShangwuGame from './en/shangwu-chouti.game.json';
import enShushangGame from './en/shushang-kaihua.game.json';
import enFankeGame from './en/fanke-weizhu.game.json';
import enMeirenGame from './en/meiren-ji.game.json';
import enKongchengGame from './en/kongcheng-ji.game.json';
import enFanjianGame from './en/fanjian-ji.game.json';
import enKurouGame from './en/kurou-ji.game.json';
import enLianhuanGame from './en/lianhuan-ji.game.json';
import enZouGame from './en/zou-weishang.game.json';

/**
 * 内容的**详情**译文（故事 / 关键抉择 / 复习题 / 关卡脚本文案）。
 *
 * 与 `./index.ts` 的摘要译文分开，是为了让首屏只加载摘要那一半 ——
 * 详情补丁随 `loadEntry()` 的懒加载 chunk 一起进（见 src/loadEntry.ts）。
 * 完整性（缺键、数组长度、译文超长）同样由 pnpm content:check 在构建期强制。
 */
export const gamePatches: Partial<Record<Locale, Record<string, unknown>>> = {
  en: {
    'caochong-elephant': enCaochongGame,
    'pangu': enPanguGame,
    'houyi': enHouyiGame,
    'nuwa': enNuwaGame,
    'jingwei': enJingweiGame,
    'kuafu': enKuafuGame,
    'yugong': enYugongGame,
    'shennong': enShennongGame,
    'qiren': enQirenGame,
    'fenghuo': enFenghuoGame,
    'taigong': enTaigongGame,
    'dayu': enDayuGame,
    'kezhou': enKezhouGame,
    'zhaosanmusi': enZhaosanmusiGame,
    'jiaotu': enJiaotuGame,
    'yangyouji': enYangyoujiGame,
    'paoding': enPaodingGame,
    'mantian-guohai': enMantianGame,
    'weiwei-jiuzhao': enWeiweiGame,
    'jiedao-sharen': enJiedaoGame,
    'yiyi-dailao': enYiyiGame,
    'chenhuo-dajie': enChenhuoGame,
    'shengdong-jixi': enShengdongGame,
    'wuzhong-shengyou': enWuzhongGame,
    'andu-chencang': enAnduGame,
    'gean-guanhuo': enGeanGame,
    'xiaoli-cangdao': enXiaoliGame,
    'lidai-taojiang': enLidaiGame,
    'shunshou-qianyang': enShunshouGame,
    'dacao-jingshe': enDacaoGame,
    'jieshi-huanhun': enJieshiGame,
    'diaohu-lishan': enDiaohuGame,
    'yuqin-guzong': enYuqinGame,
    'paozhuan-yinyu': enPaozhuanGame,
    'qinzei-qinwang': enQinzeiGame,
    'fudi-chouxin': enFudiGame,
    'hunshui-moyu': enHunshuiGame,
    'jinchan-tuoqiao': enJinchanGame,
    'guanmen-zhuozei': enGuanmenGame,
    'yuanjiao-jingong': enYuanjiaoGame,
    'jiadao-faguo': enJiadaoGame,
    'touliang-huanzhu': enTouliangGame,
    'zhisang-mahuai': enZhisangGame,
    'jiachi-budian': enJiachiGame,
    'shangwu-chouti': enShangwuGame,
    'shushang-kaihua': enShushangGame,
    'fanke-weizhu': enFankeGame,
    'meiren-ji': enMeirenGame,
    'kongcheng-ji': enKongchengGame,
    'fanjian-ji': enFanjianGame,
    'kurou-ji': enKurouGame,
    'lianhuan-ji': enLianhuanGame,
    'zou-weishang': enZouGame,
  },
};

export function gamePatchFor(locale: Locale, id: string): unknown {
  return gamePatches[locale]?.[id];
}
