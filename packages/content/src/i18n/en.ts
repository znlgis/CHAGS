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
import enFudi from './en/fudi-chouxin.json';
import enHunshui from './en/hunshui-moyu.json';
import enJinchan from './en/jinchan-tuoqiao.json';
import enGuanmen from './en/guanmen-zhuozei.json';
import enYuanjiao from './en/yuanjiao-jingong.json';
import enJiadao from './en/jiadao-faguo.json';
import enTouliang from './en/touliang-huanzhu.json';
import enZhisang from './en/zhisang-mahuai.json';
import enJiachi from './en/jiachi-budian.json';
import enShangwu from './en/shangwu-chouti.json';
import enShushang from './en/shushang-kaihua.json';
import enFanke from './en/fanke-weizhu.json';
import enMeiren from './en/meiren-ji.json';
import enKongcheng from './en/kongcheng-ji.json';
import enFanjian from './en/fanjian-ji.json';
import enKurou from './en/kurou-ji.json';
import enLianhuan from './en/lianhuan-ji.json';
import enZou from './en/zou-weishang.json';

/**
 * 英文摘要补丁：**53 份全量登记在这里**。
 *
 * 这个模块只被两类东西 import：
 * 1. Node 侧（content:check / 测试，走 '@chags/content/full' 同步拿全量）；
 * 2. 浏览器里切到英文时的一次性懒加载（见 i18n/index.ts 的 ensurePatches）。
 * 中文（默认语言）不需要任何补丁 —— 所以它不该进首屏（这里约 9 KB gzip）。
 */
export const patches: Record<string, Record<string, unknown>> = {
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
  'fudi-chouxin': enFudi,
  'hunshui-moyu': enHunshui,
  'jinchan-tuoqiao': enJinchan,
  'guanmen-zhuozei': enGuanmen,
  'yuanjiao-jingong': enYuanjiao,
  'jiadao-faguo': enJiadao,
  'touliang-huanzhu': enTouliang,
  'zhisang-mahuai': enZhisang,
  'jiachi-budian': enJiachi,
  'shangwu-chouti': enShangwu,
  'shushang-kaihua': enShushang,
  'fanke-weizhu': enFanke,
  'meiren-ji': enMeiren,
  'kongcheng-ji': enKongcheng,
  'fanjian-ji': enFanjian,
  'kurou-ji': enKurou,
  'lianhuan-ji': enLianhuan,
  'zou-weishang': enZou,
};
