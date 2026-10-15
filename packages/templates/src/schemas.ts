import { z } from 'zod';

export const StoneSchema = z.object({
  id: z.string().min(1),
  /** 石头的真实重量：局中不显示，只在最后称重时揭晓 */
  value: z.number().positive(),
  /** 画多大 —— 让小朋友用眼睛判断轻重，而不是看数字 */
  radius: z.number().positive(),
});

/**
 * substitution 模板：等量代换（曹冲称象这类"称不动就换个能称的"）
 */
export const SubstitutionLevelSchema = z
  .object({
    heavy: z.object({ weight: z.number().positive() }),
    capacity: z.number().positive(),
    tolerance: z.number().nonnegative(),
    stones: z.array(StoneSchema).min(1).max(4),
    hints: z.object({
      tooLight: z.string().min(1).max(24),
      tooHeavy: z.string().min(1).max(24),
      stuck: z.string().min(1).max(24),
    }),
  })
  .refine((l) => l.heavy.weight <= l.capacity, {
    message: '重物重量不能超过载重上限',
    path: ['heavy', 'weight'],
  })
  .refine((l) => l.capacity - l.heavy.weight >= l.tolerance, {
    message: '水痕之上要留出容差空间，否则一定判"太沉"',
    path: ['tolerance'],
  })
  .refine((l) => canReach(l.heavy.weight, l.capacity, l.tolerance, l.stones.map((s) => s.value)), {
    message: '用这些石头凑不出重物的重量（容差内无解），关卡不可通关',
    path: ['stones'],
  });

/**
 * 有界完全背包：判断用无限量的这些石头，能否凑出容差范围内的重量。
 * 内容写错不该等到孩子玩到一半才发现 —— 所以在构建期就算清楚。
 */
export function canReach(
  target: number,
  capacity: number,
  tolerance: number,
  values: number[],
): boolean {
  if (values.length === 0) return false;
  const limit = Math.ceil(capacity) + Math.max(...values);
  const reachable = new Array<boolean>(limit + 1).fill(false);
  reachable[0] = true;
  for (let i = 0; i <= limit; i += 1) {
    if (!reachable[i]) continue;
    for (const value of values) {
      const next = i + value;
      if (next <= limit) reachable[next] = true;
    }
  }
  for (let i = 0; i <= limit; i += 1) {
    if (reachable[i] && Math.abs(i - target) <= tolerance) return true;
  }
  return false;
}

/**
 * tap 模板：连点 / 长按推进一个进度。
 *
 * 关键设计：**画面完全交给游戏**（drawStage 回调）。
 * 盘古撑天、精卫填海、愚公移山、夸父追日共用这一套循环与手感曲线，
 * 但四段画面毫无关系 —— 这是"四个坚持类典故不像同一个游戏"的根本保证。
 */
export const TapMilestoneSchema = z.object({
  /** 触发进度 0..1 */
  at: z.number().min(0).max(1),
  id: z.string().min(1),
});

export const TapLevelSchema = z
  .object({
    /** tap = 连点；hold = 长按持续发力（松手就停） */
    mode: z.enum(['tap', 'hold']).default('tap'),
    targetValue: z.number().positive(),
    /** tap 模式 = 每次点击的增量；hold 模式 = 每秒的增量 */
    stepValue: z.number().positive(),
    // 计数气泡宽度自适应，英文单位（stones / baskets）会略长
    unit: z.string().min(1).max(8),
    /** 视觉阻力：越大，后半程越显得吃力 */
    resistance: z.number().min(0).max(1.5),
    hint: z.string().min(1).max(24),
    /** 可选里程碑：进度到达时触发一次（愚公的换代、智叟出现） */
    milestones: z.array(TapMilestoneSchema).max(6).default([]),
  })
  .refine((l) => l.mode === 'hold' || Number.isInteger(l.targetValue / l.stepValue), {
    message: 'tap 模式下 targetValue 必须是 stepValue 的整数倍，否则永远点不满',
    path: ['stepValue'],
  })
  .refine((l) => new Set(l.milestones.map((m) => m.id)).size === l.milestones.length, {
    message: '里程碑 id 不能重复',
    path: ['milestones'],
  });

/**
 * aim 模板：拉弓瞄准射击（后羿射日；可复用：纪昌学射、百步穿杨、惊弓之鸟）
 */
export const AimTargetSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  kind: z.string().min(1),
  /** 可选：这个目标自己的命中半径（百步穿杨：越远的那片柳叶越小） */
  radius: z.number().positive().optional(),
});

/**
 * 距离阶梯（百步穿杨）：一档一档往后退。
 * 只有"当前这一档"的靶子可以射；射中了要自己点木牌往后退，下一片叶子才露面。
 */
export const AimRungSchema = z.object({
  id: z.string().min(1),
  /** 这一档射哪一个 target */
  targetId: z.string().min(1),
  /** 脚下木牌上的距离（十步 / 三十步 / …… / 百步），双语可译 */
  label: z.string().min(1).max(12),
});

export const AimLadderSchema = z.object({
  rungs: z.array(AimRungSchema).min(2).max(6),
  /** "再退十步"的木牌：点它才往后退一档 */
  advance: z.object({ x: z.number(), y: z.number(), radius: z.number().positive() }),
});

export const AimLevelSchema = z
  .object({
    targets: z.array(AimTargetSchema).min(2).max(12),
    hitRadius: z.number().positive(),
    arrowSpeed: z.number().positive(),
    /** 射下几个算完成（后羿：10 个里射 9 个） */
    goalCount: z.number().int().positive(),
    /** 可选：距离阶梯（有了它就没有"留一个"的语义，而是一档一档射上去） */
    ladder: AimLadderSchema.optional(),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => l.ladder !== undefined || l.goalCount < l.targets.length, {
    message: 'goalCount 必须小于目标总数 —— 否则就没有"留一个"的余地了',
    path: ['goalCount'],
  })
  .refine((l) => l.ladder === undefined || l.goalCount <= l.targets.length, {
    message: 'goalCount 比目标总数还多',
    path: ['goalCount'],
  })
  .refine(
    (l) => l.ladder === undefined || new Set(l.ladder.rungs.map((r) => r.id)).size === l.ladder.rungs.length,
    { message: '阶梯每一档的 id 不能重复', path: ['ladder', 'rungs'] },
  )
  .refine(
    (l) =>
      l.ladder === undefined ||
      new Set(l.ladder.rungs.map((r) => r.targetId)).size === l.ladder.rungs.length,
    { message: '一个靶子只能出现在一档里', path: ['ladder', 'rungs'] },
  )
  .refine(
    (l) =>
      l.ladder === undefined ||
      l.ladder.rungs.every((rung) => l.targets.some((t) => t.id === rung.targetId)),
    { message: '有阶梯指向了不存在的靶子', path: ['ladder', 'rungs'] },
  )
  .refine((l) => new Set(l.targets.map((t) => t.id)).size === l.targets.length, {
    message: '目标 id 不能重复',
    path: ['targets'],
  });

export const PlaceSlotSchema = z.object({
  id: z.string().min(1),
  /** 空槽在画面上的位置 */
  x: z.number(),
  y: z.number(),
  /** 交给游戏包决定怎么画（太阳 / 月亮 / 河 / 树…） */
  kind: z.string().min(1),
  radius: z.number().positive(),
});

export const PlaceOrbSchema = z.object({
  id: z.string().min(1),
  /** 这个光球应该归到哪个槽 */
  slotId: z.string().min(1),
  /** 光球在底部托盘里的位置 */
  x: z.number(),
  y: z.number(),
  kind: z.string().min(1),
  /** 归位时用语音说出的原文，用听不用看 */
  speak: z.string().min(1),
});

/**
 * place 模板：把东西放到它该去的地方（盘古化身、孔融让梨、完璧归赵）
 */
export const PlaceLevelSchema = z
  .object({
    slots: z.array(PlaceSlotSchema).min(2).max(8),
    orbs: z.array(PlaceOrbSchema).min(2).max(8),
  })
  .refine((l) => l.orbs.length === l.slots.length, {
    message: '光球数量必须与槽位数量一致',
    path: ['orbs'],
  })
  .refine((l) => new Set(l.slots.map((s) => s.id)).size === l.slots.length, {
    message: '槽位 id 不能重复',
    path: ['slots'],
  })
  .refine((l) => l.orbs.every((o) => l.slots.some((s) => s.id === o.slotId)), {
    message: '有光球指向了不存在的槽位',
    path: ['orbs'],
  })
  .refine((l) => new Set(l.orbs.map((o) => o.slotId)).size === l.orbs.length, {
    message: '一个槽位只能有一个光球',
    path: ['orbs'],
  });

/**
 * sort 模板：把东西分进对的那一堆（神农尝百草；可复用：田忌赛马、对症下药）
 *
 * 关键设计：**先尝后分**。有 probe 的关卡里，没尝过的东西放不进木牍 ——
 * 孩子必须自己动手试过，才有分类的资格。这就是"亲身试过才知道"的玩法化。
 */
export const SortBinSchema = z.object({
  id: z.string().min(1),
  /** 怎么画由游戏包决定（麦穗 / 药碗 / 叶子加叉） */
  kind: z.string().min(1),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
  /** 木牍上的短标签（双语可译） */
  label: z.string().min(1).max(12),
});

export const SortItemSchema = z.object({
  id: z.string().min(1),
  /** 这东西该去哪个木牍 */
  binId: z.string().min(1),
  x: z.number(),
  y: z.number(),
  /** 还没尝过时的样子（一株不认识的草） */
  kind: z.string().min(1),
  /** 尝过之后显示的结果（甜 / 苦 / 麻 / 有毒），靠图标不靠文字 */
  tastedKind: z.string().min(1).optional(),
  /** 归位时用语音说出的一句话 */
  speak: z.string().min(1).optional(),
});

export const SortLevelSchema = z
  .object({
    bins: z.array(SortBinSchema).min(2).max(4),
    items: z.array(SortItemSchema).min(3).max(10),
    /** 可选：先尝后分的"嘴边" */
    probe: z
      .object({ x: z.number(), y: z.number(), radius: z.number().positive() })
      .optional(),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.bins.map((b) => b.id)).size === l.bins.length, {
    message: '木牍 id 不能重复',
    path: ['bins'],
  })
  .refine((l) => new Set(l.items.map((i) => i.id)).size === l.items.length, {
    message: '东西的 id 不能重复',
    path: ['items'],
  })
  .refine((l) => l.items.every((i) => l.bins.some((b) => b.id === i.binId)), {
    message: '有东西指向了不存在的木牍',
    path: ['items'],
  })
  .refine((l) => l.bins.every((b) => l.items.some((i) => i.binId === b.id)), {
    message: '有一块木牍永远没有东西可放 —— 内容写错了',
    path: ['items'],
  })
  .refine((l) => l.probe === undefined || l.items.every((i) => i.tastedKind !== undefined), {
    message: '有"先尝后分"却没有给每件东西写 tastedKind —— 尝完什么都看不出来',
    path: ['items'],
  });

/**
 * trace 模板：用手指划出一条路（大禹治水的"疏"；可复用：都江堰、郑国渠、张骞通西域、郑和下西洋）
 *
 * 关键设计：**只看有没有按顺序经过锚点**，不做像素比对，也不要求线画得多直 ——
 * 孩子划歪了、划断了都能接着划，已经过的锚点不会退回去。
 */
export const TraceAnchorSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  /** 判定半径：给得宽松一点，手指粗也能过 */
  radius: z.number().positive(),
});

export const TraceSegmentSchema = z.object({
  id: z.string().min(1),
  start: z.object({ x: z.number(), y: z.number() }),
  anchors: z.array(TraceAnchorSchema).max(6),
  end: z.object({ x: z.number(), y: z.number(), radius: z.number().positive() }),
});

export const TraceLevelSchema = z
  .object({
    segments: z.array(TraceSegmentSchema).min(1).max(4),
    /** 采样点之间的最大间距：不是精度要求，只挡"手指抬起又落在别处"的瞬移 */
    maxGap: z.number().positive().default(200),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.segments.map((s) => s.id)).size === l.segments.length, {
    message: '每一段的 id 不能重复',
    path: ['segments'],
  })
  .refine(
    (l) =>
      l.segments.every(
        (s) => new Set(s.anchors.map((a) => a.id)).size === s.anchors.length,
      ),
    { message: '同一段里锚点的 id 不能重复', path: ['segments'] },
  );

/**
 * wait 模板：等（太公钓鱼；可复用：苏武牧羊、卧薪尝胆、程门立雪）
 *
 * 关键设计：**以"不动作"为玩法**。主线只有一件事 —— 等。
 * 点了诱惑（换弯钩、加鱼饵）就得多等一会儿，但**有上限**：不会卡死，也不会惩罚到玩不下去。
 */
export const WaitTemptationSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  x: z.number(),
  y: z.number(),
  /** 点它要多等多久 */
  penaltyMs: z.number().nonnegative().default(5000),
  /** 点它时老人说的那句话（双语可译） */
  line: z.string().min(1),
});

export const WaitLevelSchema = z.object({
  /** 要等多久（毫秒）。无头验证下会自动缩短 */
  durationMs: z.number().positive(),
  temptations: z.array(WaitTemptationSchema).max(4),
  /** 诱惑最多把时间往后推几次 —— 保证永远等得到 */
  penaltyCap: z.number().int().min(0).max(6).default(3),
  /** 点老人时轮着说的话（支线，不影响进度） */
  lines: z.array(z.string().min(1)).min(1).max(6),
  /** 老人坐在哪儿：点他会说一句（可选） */
  listener: z
    .object({ x: z.number(), y: z.number(), radius: z.number().positive() })
    .optional(),
  /** 收束动作：等到了，把直钩收起来 */
  finale: z.object({ x: z.number(), y: z.number(), radius: z.number().positive() }),
  hint: z.string().min(1).max(24),
});

/**
 * beacon 关卡（烽火戏诸侯专用）：
 * 场景本身留在这个游戏包里（像盘古的开蛋场景一样），但**数据在这里登记**，
 * 这样双语内容校验、翻译体检、schema 体检都会覆盖到它。
 */
export const BeaconTowerSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
});

export const BeaconLinesSchema = z.object({
  /** 第一次：他们真的来了 */
  first: z.string().min(1).max(48),
  /** 第二次：又来了，走的时候有人在摇头 */
  again: z.string().min(1).max(48),
  /** 第三次：连城门都没到 */
  empty: z.string().min(1).max(48),
  /** 结语 */
  end: z.string().min(1).max(48),
});

export const BeaconLevelSchema = z
  .object({
    /** 山脊上的烽火台，从近到远 */
    towers: z.array(BeaconTowerSchema).min(3).max(8),
    /** 前面几次是戏弄：信任一格一格掉（信任格数 = 这个数） */
    decoyRounds: z.number().int().min(1).max(4).default(3),
    lines: BeaconLinesSchema,
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.towers.map((t) => t.id)).size === l.towers.length, {
    message: '烽火台的 id 不能重复',
    path: ['towers'],
  });

/**
 * mark 模板：在会动的世界上做记号（刻舟求剑；可复用：荆人涉澭、郑人买履、守株待兔）
 *
 * 关键设计：**记号刻在哪个参照系上，结果完全不同**。
 * 船会漂走（drifts: true），岸上的树、水面的浮标不会动（drifts: false）——
 * 判定就是"记号此刻在世界里的位置"和剑的位置差多少。
 */
export const MarkSurfaceSchema = z.object({
  id: z.string().min(1),
  /** 怎么画由游戏包决定：boat / tree / rock / buoy */
  kind: z.string().min(1),
  /** 刻记号的地方（世界坐标，船帮会随船漂移） */
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
  /** 这个面会不会跟着船走：船帮 = true，岸上的树 / 水面的浮标 = false */
  drifts: z.boolean(),
  /** 刻下去时的一句旁白（双语可译） */
  speak: z.string().min(1),
});

export const MarkLevelSchema = z
  .object({
    /** 剑落水的地方：从头到尾不动，而且一直在画面里 */
    sword: z.object({
      x: z.number(),
      y: z.number(),
      radius: z.number().positive(),
    }),
    surfaces: z.array(MarkSurfaceSchema).min(2).max(4),
    /** 船从落剑处漂到岸边要多久（无头验证下自动缩短） */
    driftMs: z.number().positive(),
    /** 漂多远 —— 刻在船上的记号，误差就是它 */
    driftDistance: z.number().positive(),
    /** 捞空时说的那句话 */
    missLine: z.string().min(1).max(48),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => l.surfaces.some((s) => s.drifts) && l.surfaces.some((s) => !s.drifts), {
    message: '至少要有一个"会漂走"的面和一个"不动"的面，否则这一关没有可比较的选择',
    path: ['surfaces'],
  })
  .refine((l) => new Set(l.surfaces.map((s) => s.id)).size === l.surfaces.length, {
    message: '面的 id 不能重复',
    path: ['surfaces'],
  })
  .refine(
    (l) => l.surfaces.filter((s) => s.drifts).every((s) => Math.abs(s.x - l.sword.x) <= l.sword.radius),
    {
      message: '会漂走的面必须一开始就压在剑落水的位置上 —— 否则刻它连"一开始是对的"都做不到',
      path: ['surfaces'],
    },
  );

/**
 * split 模板：总量不变，换个分法（朝三暮四；可复用：不患寡而患不均、二桃杀三士）
 *
 * 关键设计：**总数守恒看得见**。七颗东西串在一条绳上，只有中间那块木牌在移动 ——
 * 谁都看得出"没有人加、没有人减"。观众只看其中一头，于是换了说法就换了脸色。
 */
export const SplitBinSchema = z.object({
  id: z.string().min(1),
  /** 怎么画由游戏包决定：morning / evening */
  kind: z.string().min(1),
  /** 这一头在画面上的位置（标签画在它下面） */
  x: z.number(),
  y: z.number(),
  /** 短标签（双语可译） */
  label: z.string().min(1).max(8),
});

export const SplitLevelSchema = z
  .object({
    total: z.number().int().min(2).max(12),
    /** 绳子的两头：bins[0] 是左（第一种分法），bins[1] 是右 */
    bins: z.array(SplitBinSchema).length(2),
    /** 开局的分法：左边几颗（原文是朝三暮四 → 3） */
    initialLeft: z.number().int().min(0),
    /** 每一头至少留几颗才算分好 —— 一侧清空不算"分好了" */
    minPerSide: z.number().int().min(0).max(3).default(1),
    /** 观众只看其中一头：够这个数就高兴 */
    audience: z.object({
      watchedBinId: z.string().min(1),
      happyAt: z.number().int().positive(),
      happyLine: z.string().min(1).max(48),
      angryLine: z.string().min(1).max(48),
      /** 可选：有一头被分空时说的那句话（只陈述，不评价） */
      greedyLine: z.string().min(1).max(48).optional(),
    }),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => l.audience.happyAt <= l.total, {
    message: '高兴的门槛比总数还大 —— 那观众永远不会高兴',
    path: ['audience', 'happyAt'],
  })
  .refine((l) => l.bins.some((b) => b.id === l.audience.watchedBinId), {
    message: '观众看的那个盘子不存在',
    path: ['audience', 'watchedBinId'],
  })
  .refine((l) => l.initialLeft >= 0 && l.initialLeft <= l.total, {
    message: '开局的分法超出了总数',
    path: ['initialLeft'],
  })
  .refine((l) => l.minPerSide * 2 <= l.total, {
    message: '每一头都要留 minPerSide 颗，但总数不够分',
    path: ['minPerSide'],
  })
  .refine((l) => l.bins[0]!.x < l.bins[1]!.x, {
    message: '绳子的左端必须在右端左边 —— 否则"左边几颗"的算法会反掉',
    path: ['bins'],
  })
  .refine((l) => l.bins[0]!.y === l.bins[1]!.y, {
    message: '两头必须落在同一条绳子上（y 相同）',
    path: ['bins'],
  })
  .refine((l) => l.audience.happyAt >= l.minPerSide && l.total - l.audience.happyAt >= l.minPerSide, {
    message: '按观众的高兴门槛去分，会有一头不够 minPerSide —— 这一关分不出"两边都留着"的答案',
    path: ['audience', 'happyAt'],
  });

/**
 * burrow 模板：预留退路（狡兔三窟；可复用：曲突徙薪、未雨绸缪、居安思危）
 *
 * 关键设计：**退路要几条，是被危险的数量逼出来的**。
 * 危险一次会同时守住 blocks 个洞口 —— 洞口比它多一个，兔子就还有路走。
 * "三窟"不是文案说的，是关卡数据里那条最凶的危险（blocks: 2）逼出来的。
 */
export const BurrowSpotSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
  /** 怎么画由游戏包决定：草丛 / 土坡 / 石头下 */
  kind: z.string().min(1),
});

export const BurrowWaveSchema = z.object({
  id: z.string().min(1),
  /** 这一次危险会同时守住几个洞口 */
  blocks: z.number().int().min(1).max(4),
  /** 危险来的时候说的一句话（双语可译） */
  speak: z.string().min(1).max(48),
});

export const BurrowLevelSchema = z
  .object({
    spots: z.array(BurrowSpotSchema).min(2).max(4),
    /** 每个洞要挖几下才算通 */
    digsNeeded: z.number().int().min(1).max(6),
    waves: z.array(BurrowWaveSchema).min(1).max(3),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.spots.map((s) => s.id)).size === l.spots.length, {
    message: '土坡的 id 不能重复',
    path: ['spots'],
  })
  .refine((l) => new Set(l.waves.map((w) => w.id)).size === l.waves.length, {
    message: '危险的 id 不能重复',
    path: ['waves'],
  })
  .refine((l) => Math.max(...l.waves.map((w) => w.blocks)) < l.spots.length, {
    message: '有危险一次堵住的洞口数不少于洞口总数 —— 这一局无论怎么挖都躲不过去',
    path: ['waves'],
  });

/**
 * butcher 关卡（庖丁解牛专用）：
 * 场景本身留在游戏包里（像烽火 beacon、盘古 chaos 一样），但**数据在这里登记** ——
 * 双语内容校验、schema 体检都会覆盖到它。
 */
export const ButcherPieceSchema = z.object({
  id: z.string().min(1),
  /** 怎么画由游戏包决定：head / neck / ribs / foreleg … */
  kind: z.string().min(1),
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  /** 顺着这条缝推出去的方向：0 = 向右，90 = 向下（屏幕坐标） */
  grooveDeg: z.number(),
  /** 抓取半径：手指落在这一块上才算抓住 */
  radius: z.number().positive(),
});

export const ButcherLinesSchema = z.object({
  /** 第一刀（砍在骨头上）时说的话 */
  first: z.string().min(1).max(48),
  /** 缝亮起来时说的话 */
  grain: z.string().min(1).max(48),
  /** 最后几块不给提示时说的话 */
  free: z.string().min(1).max(48),
  /** 结局念的原文 */
  end: z.string().min(1).max(64),
});

export const ButcherLevelSchema = z
  .object({
    pieces: z.array(ButcherPieceSchema).min(4).max(10),
    /** 第一段允许乱砍几下（每砍一下刀口多一个缺口） */
    blindCuts: z.number().int().min(1).max(3).default(1),
    /** 最后几块不给提示 —— "以神遇而不以目视" */
    blindTail: z.number().int().min(0).max(4).default(2),
    lines: ButcherLinesSchema,
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.pieces.map((p) => p.id)).size === l.pieces.length, {
    message: '骨块的 id 不能重复',
    path: ['pieces'],
  })
  .refine((l) => l.blindTail < l.pieces.length - 1, {
    message: '不给提示的那几块太多了 —— 至少要留一块给"缝亮着"的那一段',
    path: ['blindTail'],
  })
  .refine((l) => new Set(l.pieces.map((p) => p.grooveDeg)).size >= 4, {
    message: '每一块的缝方向太雷同了 —— 那就不是"顺着缝走刀"，而是重复同一个动作',
    path: ['pieces'],
  });

/**
 * ruse 模板：示形 —— 我做我的，你看到的是我想让你看到的。
 *
 * 两个模式：
 * - hide（瞒天过海）：每件显眼的东西选一个"最平常的外壳"，灯扫过来时外壳不对就被退回；
 * - divert（声东击西）：靠时机 —— 灯照哪一侧，另一侧才走得通；敲锣能把灯留在左侧。
 * 被识破 = 退回原位，**零惩罚**（不扣星、不结束）。
 */
export const RuseShellSchema = z.object({
  id: z.string().min(1),
  /** 外壳长什么样：straw 柴捆 / sack 米袋 / net 渔网 */
  kind: z.string().min(1),
  x: z.number(),
  y: z.number(),
});

export const RuseItemSchema = z.object({
  id: z.string().min(1),
  /** 这件东西本身是什么：drum 大鼓 / banner 长旗 / armor 盔甲架 */
  kind: z.string().min(1),
  x: z.number(),
  y: z.number(),
  /** hide 模式：它该装成什么样（必须与某个外壳的 kind 相同，否则这一关无解） */
  disguiseAs: z.string().min(1).optional(),
  shells: z.array(RuseShellSchema).max(3).default([]),
});

export const RuseNoiseSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  /** 敲一下，灯留在这一侧多久 */
  holdMs: z.number().positive(),
});

export const RuseLevelSchema = z
  .object({
    mode: z.enum(['hide', 'divert']),
    /** 检查口：把东西拖过它就永久安全 */
    gate: z.object({ x: z.number(), y: z.number(), radius: z.number().positive() }),
    items: z.array(RuseItemSchema).min(2).max(6),
    /** 灯：每 intervalMs 亮一次，亮之前 warnMs 有征兆 */
    lamp: z.object({ intervalMs: z.number().positive(), warnMs: z.number().nonnegative() }),
    /** divert：灯照左 / 照右 */
    gaze: z
      .object({
        left: z.object({ x: z.number(), y: z.number() }),
        right: z.object({ x: z.number(), y: z.number() }),
      })
      .optional(),
    noises: z.array(RuseNoiseSchema).max(3).default([]),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.items.map((i) => i.id)).size === l.items.length, {
    message: '东西的 id 不能重复',
    path: ['items'],
  })
  .refine((l) => new Set(l.noises.map((n) => n.id)).size === l.noises.length, {
    message: '锣鼓的 id 不能重复',
    path: ['noises'],
  })
  .refine(
    (l) =>
      l.mode !== 'hide' ||
      l.items.every(
        (i) => i.disguiseAs !== undefined && i.shells.some((s) => s.kind === i.disguiseAs),
      ),
    {
      message: 'hide 模式：每件东西都要写 disguiseAs，而且外壳里必须有一个正好是它',
      path: ['items'],
    },
  )
  .refine(
    (l) =>
      l.mode !== 'hide' ||
      l.items.every((i) => i.shells.filter((s) => s.kind === i.disguiseAs).length === 1),
    { message: 'hide 模式：正确的外壳只能有一个（否则"哪个才对"就没有答案）', path: ['items'] },
  )
  .refine((l) => l.mode !== 'divert' || (l.gaze !== undefined && l.noises.length >= 1), {
    message: 'divert 模式：必须有 gaze（灯照左/照右）与至少一个可敲的锣鼓',
    path: ['gaze'],
  })
  .refine((l) => l.mode !== 'divert' || l.items.every((i) => i.shells.length === 0), {
    message: 'divert 模式不换外壳：靠的是时机，不是伪装',
    path: ['items'],
  });

/** 正面推一次的增量：阻力越大，推得越少（siege 与关卡验算共用） */
export function siegeGain(resistance: number): number {
  return Math.max(0.2, 1 - resistance / 10);
}

/**
 * siege 模板：打要害 —— 正面硬推推不动，去动他非救不可的地方。
 * 本辑只有 vital 模式；断退路 / 抽支撑 / 收梯子在后续批次扩。
 */
export const SiegeVitalSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
  /** 点中它，正面阻力降多少 */
  relief: z.number().positive(),
});

export const SiegeLevelSchema = z
  .object({
    mode: z.enum(['vital']),
    front: z.object({ x: z.number(), y: z.number(), radius: z.number().positive() }),
    vital: z.array(SiegeVitalSchema).min(1).max(3),
    /** 正面阻力 0–10：越大越推不动 */
    resistance: z.number().min(0).max(10),
    goal: z.number().positive(),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.vital.map((v) => v.id)).size === l.vital.length, {
    message: '要害的 id 不能重复',
    path: ['vital'],
  })
  .refine(
    (l) => {
      const left = Math.max(0, l.resistance - l.vital.reduce((sum, v) => sum + v.relief, 0));
      return Math.ceil(l.goal / siegeGain(left)) <= 40;
    },
    {
      message: '点完所有要害之后，正面还要推 40 次以上 —— 这一关太磨人',
      path: ['goal'],
    },
  );

/**
 * borrow 模板：借力 —— 力不一定要自己出。
 * 自己出力（self）永远不够；要有支点（fulcrum）+ 力源（source）凑够 needed 才抬得起来。
 */
export const BorrowPropSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['self', 'fulcrum', 'source']),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
  /** 连上它贡献多少力 */
  power: z.number().nonnegative(),
});

export const BorrowLevelSchema = z
  .object({
    mode: z.enum(['force']),
    load: z.object({
      x: z.number(),
      y: z.number(),
      radius: z.number().positive(),
      weight: z.number().positive(),
    }),
    props: z.array(BorrowPropSchema).min(2).max(6),
    needed: z.number().positive(),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.props.map((p) => p.id)).size === l.props.length, {
    message: '支点 / 力源的 id 不能重复',
    path: ['props'],
  })
  .refine((l) => l.props.some((p) => p.kind === 'fulcrum'), {
    message: '没有支点：杠杆总得有个垫脚的地方',
    path: ['props'],
  })
  .refine((l) => l.props.some((p) => p.kind === 'self'), {
    message: '至少要有一个"自己出力"的选项 —— 不然孩子体会不到"自己不够"',
    path: ['props'],
  })
  .refine(
    (l) => l.props.filter((p) => p.kind === 'self').reduce((sum, p) => sum + p.power, 0) < l.needed,
    { message: '光靠自己就够力了 —— "借力"这件事就不成立了', path: ['needed'] },
  )
  .refine(
    (l) =>
      l.props.filter((p) => p.kind === 'source').reduce((sum, p) => sum + p.power, 0) >= l.needed,
    { message: '把所有力源都借来也不够 —— 这一关无解', path: ['needed'] },
  );

/**
 * stillness 模板：忍 —— 最难的动作是不动。
 * 本辑只有 bide（以逸待劳：一鼓作气，再而衰，三而竭）；空城计 / 假痴不癫在后续批次扩。
 */
export const StillnessBeatSchema = z.object({
  id: z.string().min(1),
  /** 鼓响多久：这段时间里出击 = 白费力气 */
  drumMs: z.number().positive(),
  /** 鼓停之后的窗口 */
  windowMs: z.number().positive(),
  /** 这一通的窗口该不该出击：只有一通是真的 */
  correct: z.boolean(),
});

export const StillnessLevelSchema = z
  .object({
    mode: z.enum(['bide']),
    beats: z.array(StillnessBeatSchema).min(2).max(4),
    action: z.object({ x: z.number(), y: z.number(), radius: z.number().positive() }),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.beats.map((b) => b.id)).size === l.beats.length, {
    message: '每一通鼓的 id 不能重复',
    path: ['beats'],
  })
  .refine((l) => l.beats.filter((b) => b.correct).length === 1, {
    message: '恰好要有一通鼓的窗口是对的（多一个少一个都不行）',
    path: ['beats'],
  })
  .refine((l) => l.beats[l.beats.length - 1]!.correct, {
    message: '该出击的那一通必须是最后一通 —— 一鼓作气，再而衰，三而竭',
    path: ['beats'],
  });

/**
 * window 模板：时机窗口 —— 窗口只开一小会儿，早了晚了都白费。
 * 本辑只有 fire（趁火打劫）；顺手牵羊（glimpse）/ 混水摸鱼（stir）在后续批次扩。
 */
export const WindowJobSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
  /** 这件活儿要干多久 */
  workMs: z.number().positive(),
});

export const WindowLevelSchema = z
  .object({
    mode: z.enum(['fire', 'glimpse', 'stir']),
    /** 稳多久、乱多久（glimpse：每隔一轮路过一个机会） */
    cycle: z.object({ calmMs: z.number().positive(), windowMs: z.number().positive() }),
    jobs: z.array(WindowJobSchema).min(2).max(4),
    /** 点一下推进多少毫秒的活儿 */
    workTapMs: z.number().positive(),
    goal: z.number().int().positive(),
    /** glimpse（顺手牵羊）：这一趟赶路总共多久 —— 走完还没抓够就重走一遍 */
    travelMs: z.number().positive().optional(),
    /** stir（混水摸鱼）：窗口是自己搅出来的 */
    stir: z
      .object({
        x: z.number(),
        y: z.number(),
        radius: z.number().positive(),
        /** 点一下搅多久的浑 */
        perTapMs: z.number().positive(),
        /** 每秒澄清多少 */
        clearPerSec: z.number().positive(),
        /** 浑到多少算"浑水" */
        muddyAt: z.number().positive().max(100),
      })
      .optional(),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.jobs.map((j) => j.id)).size === l.jobs.length, {
    message: '活儿的 id 不能重复',
    path: ['jobs'],
  })
  .refine((l) => l.goal <= l.jobs.length, {
    message: '要干的活儿比摆出来的还多',
    path: ['goal'],
  })
  .refine((l) => l.jobs.every((j) => j.workMs <= l.cycle.windowMs), {
    message: '有活儿在一个窗口里根本干不完 —— 那就不是"抓时机"，是"不可能"',
    path: ['jobs'],
  })
  .refine((l) => l.workTapMs < l.cycle.windowMs, {
    message: '点一下就用掉整个窗口 —— 一件也干不完',
    path: ['workTapMs'],
  })
  .refine((l) => l.mode !== 'glimpse' || l.travelMs !== undefined, {
    message: 'glimpse（顺手牵羊）模式必须给 travelMs —— 这一趟要走多久',
    path: ['travelMs'],
  })
  .refine((l) => l.mode !== 'fire' || l.travelMs === undefined, {
    message: 'fire 模式没有"一趟走完"这回事，不要写 travelMs',
    path: ['travelMs'],
  })
  .refine((l) => l.mode !== 'stir' || l.stir !== undefined, {
    message: 'stir（混水摸鱼）模式必须给 stir —— 水要怎么搅、多快澄清',
    path: ['stir'],
  })
  .refine((l) => l.mode === 'stir' || l.stir === undefined, {
    message: 'fire / glimpse 模式没有"搅水"，不要写 stir',
    path: ['stir'],
  });

/**
 * show 模板：造势 —— 从"什么都没有"开始，把一个不存在的东西**维持住**。
 * 本辑只有 draw（第 7 计无中生有：雾里画草人）；树上开花（借现成的势）第五辑再扩。
 */
export const ShowSlotSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
});

export const ShowLevelSchema = z
  .object({
    mode: z.enum(['draw']),
    slots: z.array(ShowSlotSchema).min(3).max(8),
    /** 一笔能立多久：到点就淡掉，得回头补 */
    fadeMs: z.number().positive(),
    /** 同时立着的影子数达到它，对方的疑心才开始涨 */
    needed: z.number().int().positive(),
    /** 疑心涨到多少算成功 */
    goal: z.number().positive(),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.slots.map((s) => s.id)).size === l.slots.length, {
    message: '空位的 id 不能重复',
    path: ['slots'],
  })
  .refine((l) => l.needed <= l.slots.length, {
    message: '要同时立住的影子比空位还多 —— 这一关不可能过',
    path: ['needed'],
  });

/**
 * twoline 模板：双线 —— 明面撑住、暗里推进，两条线抢同一根手指。
 * 本辑只有 stack（第 8 计暗度陈仓）；反间计（plant）第六辑再扩。
 */
export const TwolineLevelSchema = z
  .object({
    mode: z.enum(['stack']),
    /** 明线：会随时间回落，点一下补一截；跌破 minKeep 就被看穿（零惩罚） */
    decoy: z.object({
      x: z.number(),
      y: z.number(),
      radius: z.number().positive(),
      max: z.number().positive(),
      decayPerSec: z.number().positive(),
      topUp: z.number().positive(),
      minKeep: z.number().positive(),
    }),
    /** 暗线：点一下推一截，到 goal 就算成 */
    real: z.object({
      x: z.number(),
      y: z.number(),
      radius: z.number().positive(),
      step: z.number().positive(),
      goal: z.number().positive(),
    }),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => l.decoy.minKeep < l.decoy.max, {
    message: 'minKeep 不小于上限 —— 明线永远掉不下来，这一关没有张力',
    path: ['decoy', 'minKeep'],
  })
  .refine((l) => l.decoy.topUp <= l.decoy.max, {
    message: '补一笔就超过上限了',
    path: ['decoy', 'topUp'],
  })
  .refine((l) => l.real.goal / l.real.step <= 60, {
    message: '暗线要点 60 下以上才推得完 —— 太磨人',
    path: ['real', 'step'],
  });

/**
 * read 模板：识破 —— 好听的话底下，动作会露破绽。
 * 破绽只在窗口里看得见；没有破绽的时候点只是没收获（零惩罚）。本辑只有 inspect。
 */
export const ReadTellSchema = z.object({
  id: z.string().min(1),
  /** 从这一局开始算起的出现时刻 */
  atMs: z.number().nonnegative(),
  /** 破绽露多久 */
  windowMs: z.number().positive(),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
  /** 这是什么破绽：eye 眼神 / sleeve 袖口 / finger 手指 */
  kind: z.string().min(1),
});

export const ReadLevelSchema = z
  .object({
    mode: z.enum(['inspect']),
    speaker: z.object({ x: z.number(), y: z.number() }),
    tells: z.array(ReadTellSchema).min(3).max(6),
    goal: z.number().int().positive(),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.tells.map((t) => t.id)).size === l.tells.length, {
    message: '破绽的 id 不能重复',
    path: ['tells'],
  })
  .refine((l) => l.tells.every((t, i) => i === 0 || t.atMs > l.tells[i - 1]!.atMs), {
    message: '破绽要按时间先后排（atMs 递增），否则"此刻该看哪儿"就算不出来',
    path: ['tells'],
  })
  .refine((l) => l.goal <= l.tells.length, {
    message: '要看穿的破绽比出现的还多',
    path: ['goal'],
  });

/**
 * matchup 模板：配对编排 —— 手里这些牌，怎么配对。
 * 本辑只有 pair（第 11 计李代桃僵：三局两胜）；远交近攻（order）第四辑再扩。
 */
export const MatchupHorseSchema = z.object({
  id: z.string().min(1),
  rank: z.enum(['top', 'mid', 'low']),
  power: z.number().positive(),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
});

export const MatchupRivalSchema = z.object({
  id: z.string().min(1),
  power: z.number().positive(),
  x: z.number(),
  y: z.number(),
  /** 木牌上的短标签（双语可译，≤12 字） */
  label: z.string().min(1).max(12),
});

/** 三匹马 vs 三场：六种配对里最多能赢几场（内容写错不该等孩子打到一半才发现） */
export function bestMatchupWins(
  horses: readonly { power: number }[],
  rivals: readonly { power: number }[],
): number {
  let best = 0;
  const walk = (rest: number[], acc: number[]): void => {
    if (rest.length === 0) {
      const wins = acc.filter((h, i) => horses[h]!.power > rivals[i]!.power).length;
      best = Math.max(best, wins);
      return;
    }
    for (const index of rest) walk(rest.filter((x) => x !== index), [...acc, index]);
  };
  if (horses.length === 3 && rivals.length === 3) walk([0, 1, 2], []);
  return best;
}

export const MatchupLevelSchema = z
  .object({
    mode: z.enum(['pair']),
    horses: z.array(MatchupHorseSchema).length(3),
    rivals: z.array(MatchupRivalSchema).length(3),
    /** 赢几场算胜（三局两胜 = 2） */
    needWins: z.number().int().min(1).max(3),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.horses.map((h) => h.rank)).size === 3, {
    message: '三匹马的上 / 中 / 下要各有一匹',
    path: ['horses'],
  })
  .refine((l) => new Set(l.rivals.map((r) => r.id)).size === l.rivals.length, {
    message: '对手的 id 不能重复',
    path: ['rivals'],
  })
  .refine((l) => bestMatchupWins(l.horses, l.rivals) >= l.needWins, {
    message: '六种配对都赢不到 needWins 场 —— 这一关不可能赢',
    path: ['needWins'],
  });

/* ---------------- probe：试探（打草惊蛇 / 擒贼擒王） ---------------- */

export const ProbePatchSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
  /** 这丛草里有什么：snake 有蛇 / clear 空的 */
  has: z.enum(['snake', 'clear']),
});

/** 打草惊蛇：一处一处敲过去；敲到蛇，附近的草丛一起被搅乱 —— 这就是"打草"的代价 */
export const ProbeKnockSchema = z
  .object({
    mode: z.literal('knock'),
    patches: z.array(ProbePatchSchema).min(3).max(6),
    scareRadius: z.number().positive(),
    /** 确认安全之后走到这里 */
    exit: z.object({ x: z.number(), y: z.number(), radius: z.number().positive() }),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.patches.map((p) => p.id)).size === l.patches.length, {
    message: '草丛的 id 不能重复',
    path: ['patches'],
  })
  .refine((l) => l.patches.some((p) => p.has === 'clear'), {
    message: '一处安全的草丛都没有 —— 这一关不可能过',
    path: ['patches'],
  })
  .refine(
    (l) => {
      const snakes = l.patches.filter((p) => p.has === 'snake');
      return l.patches
        .filter((p) => p.has === 'clear')
        .some((safe) => snakes.every((s) => Math.hypot(safe.x - s.x, safe.y - s.y) > l.scareRadius));
    },
    {
      message: '每一处安全的草丛都落在某条蛇的惊吓范围里 —— 一敲就会被搅乱，这一关可能无解',
      path: ['scareRadius'],
    },
  );

export const ProbeFigureSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
  isKing: z.boolean(),
});

/** 擒贼擒王：一排一模一样的身影，用没有杀伤的蒿箭一个个试出王 */
export const ProbeSpotSchema = z
  .object({
    mode: z.literal('spot'),
    figures: z.array(ProbeFigureSchema).min(3).max(7),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.figures.map((f) => f.id)).size === l.figures.length, {
    message: '身影的 id 不能重复',
    path: ['figures'],
  })
  .refine((l) => l.figures.filter((f) => f.isKing).length === 1, {
    message: '恰好要有一个是王（多一个少一个都不行）',
    path: ['figures'],
  });

export const ProbeLevelSchema = z.union([ProbeKnockSchema, ProbeSpotSchema]);

/* ---------------- lure：诱饵（调虎离山 / 抛砖引玉） ---------------- */

export const LureBaitSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
  /** 放这里能让岗位空多久 */
  awayMs: z.number().positive(),
});

/** 调虎离山：把看守引开，趁空档把东西拿走 —— 拿东西要连续的空档时间 */
export const LureDecoySchema = z
  .object({
    mode: z.literal('decoy'),
    guard: z.object({ x: z.number(), y: z.number(), radius: z.number().positive() }),
    baits: z.array(LureBaitSchema).min(2).max(4),
    prize: z.object({
      x: z.number(),
      y: z.number(),
      radius: z.number().positive(),
      needMs: z.number().positive(),
    }),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.baits.map((b) => b.id)).size === l.baits.length, {
    message: '诱饵点的 id 不能重复',
    path: ['baits'],
  })
  .refine((l) => l.baits.some((b) => b.awayMs >= l.prize.needMs), {
    message: '没有一处诱饵能让岗位空够久 —— 这一关不可能过',
    path: ['baits'],
  });

export const LureOfferSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
  /** 这块"砖"是什么：paper 纸 / ink 墨 / brush 笔 */
  kind: z.string().min(1),
});

export const LureReturnSchema = z.object({
  offerId: z.string().min(1),
  /** 对方还回来的"玉" */
  kind: z.string().min(1),
  value: z.number().positive(),
});

/** 抛砖引玉：先给一块砖，对方拿出更好的来换 —— 难在挑对那块砖 */
export const LureTradeSchema = z
  .object({
    mode: z.literal('trade'),
    partner: z.object({ x: z.number(), y: z.number() }),
    offers: z.array(LureOfferSchema).min(2).max(4),
    returns: z.array(LureReturnSchema).min(2).max(4),
    needed: z.number().positive(),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.offers.map((o) => o.id)).size === l.offers.length, {
    message: '东西的 id 不能重复',
    path: ['offers'],
  })
  .refine((l) => l.offers.every((o) => l.returns.some((r) => r.offerId === o.id)), {
    message: '有一样东西递过去没人接 —— 每块"砖"都要写明换回什么',
    path: ['returns'],
  })
  .refine((l) => new Set(l.returns.map((r) => r.offerId)).size === l.returns.length, {
    message: '一样东西只能换回一件',
    path: ['returns'],
  })
  .refine((l) => l.returns.some((r) => r.value >= l.needed), {
    message: '怎么换都到不了 needed —— 这一关不可能过',
    path: ['needed'],
  });

export const LureLevelSchema = z.union([LureDecoySchema, LureTradeSchema]);

/* ---------------- chase：追而不逼（欲擒故纵） ---------------- */

export const ChaseLevelSchema = z
  .object({
    mode: z.literal('hold'),
    start: z.object({ distance: z.number().positive(), stamina: z.number().positive() }),
    /** 要维持的距离区间（0–100） */
    keepMin: z.number().nonnegative(),
    keepMax: z.number().positive(),
    /** 按住缩得多快、松手拉得多快 */
    closePerSec: z.number().positive(),
    farPerSec: z.number().positive(),
    /** 距离在区间内：对方体力每秒掉多少 */
    drainPerSec: z.number().positive(),
    /** 逼太近：体力每秒回多少 */
    recoverPerSec: z.number().positive(),
    /** 跟丢：这段追逐的进度每秒退多少 */
    losePerSec: z.number().positive(),
    hold: z.object({ x: z.number(), y: z.number(), radius: z.number().positive() }),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => l.keepMin < l.keepMax, {
    message: 'keepMin 不小于 keepMax —— 那就没有"要维持的区间"了',
    path: ['keepMin'],
  })
  .refine((l) => l.recoverPerSec < l.drainPerSec, {
    message: '逼太近时体力回得比掉得还快 —— 这一关没有张力（甚至不可能过）',
    path: ['recoverPerSec'],
  })
  .refine((l) => l.keepMax <= 100 && l.start.distance <= 100, {
    message: '距离按 0–100 算，keepMax / start.distance 不能超过 100',
    path: ['keepMax'],
  })
  .refine((l) => l.start.distance > l.keepMin && l.start.distance <= l.keepMax, {
    message: '开局的距离要在区间里（不能一上来就已经逼太近 / 跟丢）',
    path: ['start', 'distance'],
  });

/* ---------------- borrow 扩展：banner（借尸还魂） ---------------- */

export const BorrowFlagSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
  /** 这面旗能召回多少人 */
  rally: z.number().int().positive(),
});

export const BorrowScatteredSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
});

/**
 * 借尸还魂：把旧旗竖起来，散掉的人自己归队。
 * 与 force（借力：支点 + 力源）是两个模式 —— `BorrowLevelSchema`（force）一个字没改。
 */
export const BorrowBannerLevelSchema = z
  .object({
    mode: z.literal('banner'),
    pole: z.object({ x: z.number(), y: z.number(), radius: z.number().positive() }),
    flags: z.array(BorrowFlagSchema).min(2).max(4),
    scattered: z.array(BorrowScatteredSchema).min(3).max(8),
    needed: z.number().int().positive(),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.flags.map((f) => f.id)).size === l.flags.length, {
    message: '旗的 id 不能重复',
    path: ['flags'],
  })
  .refine((l) => new Set(l.scattered.map((s) => s.id)).size === l.scattered.length, {
    message: '散落的人 id 不能重复',
    path: ['scattered'],
  })
  .refine((l) => l.needed <= l.scattered.length, {
    message: '要召回的人比散在外面的还多',
    path: ['needed'],
  })
  .refine((l) => l.flags.reduce((sum, f) => sum + f.rally, 0) >= l.needed, {
    message: '所有旗加起来也召不够 needed —— 这一关不可能过',
    path: ['needed'],
  });

/* ---------------- swap：替换（金蝉脱壳） ---------------- */

export const SwapPostSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
  /** 这个位置原本站着的"样子"：替身要挑同样 kind 的 */
  kind: z.string().min(1),
});

export const SwapSpareSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
  kind: z.string().min(1),
});

/**
 * 金蝉脱壳：把一排"还站在那儿的人"换成替身，样子要对；
 * 检查者每隔 peekMs 抬头看一次，没换好的位置会被戳穿（撤销换装，零惩罚）。
 */
export const SwapLevelSchema = z
  .object({
    mode: z.literal('shell'),
    posts: z.array(SwapPostSchema).min(3).max(6),
    spares: z.array(SwapSpareSchema).min(3).max(6),
    peekMs: z.number().positive(),
    exit: z.object({ x: z.number(), y: z.number(), radius: z.number().positive() }),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.posts.map((p) => p.id)).size === l.posts.length, {
    message: '位置的 id 不能重复',
    path: ['posts'],
  })
  .refine((l) => new Set(l.spares.map((s) => s.id)).size === l.spares.length, {
    message: '替身的 id 不能重复',
    path: ['spares'],
  })
  .refine((l) => l.posts.every((post) => l.spares.some((spare) => spare.kind === post.kind)), {
    message: '有位置找不到同 kind 的替身 —— 这一关不可能全换好',
    path: ['spares'],
  });

/* ---------------- chain：连环（假道伐虢） ---------------- */

export const ChainGateSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
  /** 关口木牌上的短标签（双语可译，≤12 字） */
  label: z.string().min(1).max(12),
});

/**
 * 假道伐虢：先谈成借路，再按顺序取下沿途关口，最后回师。
 * 顺序不能跳 —— 没借到路一个关口也拿不了；前一个没拿下，后一个动不了。
 */
export const ChainLevelSchema = z
  .object({
    mode: z.literal('pass'),
    envoy: z.object({ x: z.number(), y: z.number(), radius: z.number().positive() }),
    gates: z.array(ChainGateSchema).min(3).max(5),
    home: z.object({ x: z.number(), y: z.number(), radius: z.number().positive() }),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.gates.map((g) => g.id)).size === l.gates.length, {
    message: '关口的 id 不能重复',
    path: ['gates'],
  });

/* ---------------- siege 扩展：support（釜底抽薪）/ close（关门捉贼） ---------------- */

export const SiegeLogSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
  /** 抽掉它火势降多少 */
  relief: z.number().positive(),
  /** 是不是"根上的那根柴"（抽掉它骤降） */
  base: z.boolean(),
});

/** 釜底抽薪：不跟火硬碰，从底下把柴一根根抽走 */
export const SiegeSupportSchema = z
  .object({
    mode: z.literal('support'),
    fire: z.object({ x: z.number(), y: z.number(), level: z.number().positive() }),
    logs: z.array(SiegeLogSchema).min(3).max(6),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.logs.map((x) => x.id)).size === l.logs.length, {
    message: '柴的 id 不能重复',
    path: ['logs'],
  })
  .refine((l) => l.logs.some((x) => x.base), {
    message: '没有一根是"根上的柴" —— 这一计就没有落点',
    path: ['logs'],
  })
  .refine((l) => l.logs.reduce((sum, x) => sum + x.relief, 0) >= l.fire.level, {
    message: '把所有柴抽光火也灭不了 —— 这一关不可能过',
    path: ['logs'],
  });

export const SiegeExitSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
  /** 关上这扇门要多久 */
  closeMs: z.number().positive(),
});

/** 关门捉贼：抢在贼跑掉之前把所有出口关上 */
export const SiegeCloseSchema = z
  .object({
    mode: z.literal('close'),
    exits: z.array(SiegeExitSchema).min(3).max(5),
    thief: z.object({ x: z.number(), y: z.number(), radius: z.number().positive() }),
    /** 贼多久之后开始跑 */
    escapeAfterMs: z.number().positive(),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.exits.map((x) => x.id)).size === l.exits.length, {
    message: '出口的 id 不能重复',
    path: ['exits'],
  })
  .refine((l) => l.exits.reduce((sum, x) => sum + x.closeMs, 0) < l.escapeAfterMs, {
    message: '把所有门关一遍的时间比贼跑掉的时间还长 —— 这一关不可能过',
    path: ['escapeAfterMs'],
  });

/* ---------------- matchup 扩展：order（远交近攻） ---------------- */

export const MatchupNeighborSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
  label: z.string().min(1).max(12),
  /** 近的动手（attack）、远的先结好（ally） */
  stance: z.enum(['attack', 'ally']),
});

/** 远交近攻：一圈势力，按"近的先解决、远的先结好"的顺序点过去 */
export const MatchupOrderLevelSchema = z
  .object({
    mode: z.literal('order'),
    neighbors: z.array(MatchupNeighborSchema).min(4).max(8),
    /** 正确顺序（neighbor id 的排列） */
    sequence: z.array(z.string().min(1)).min(4).max(8),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.neighbors.map((n) => n.id)).size === l.neighbors.length, {
    message: '势力的 id 不能重复',
    path: ['neighbors'],
  })
  .refine(
    (l) =>
      l.sequence.length === l.neighbors.length &&
      new Set(l.sequence).size === l.sequence.length &&
      l.sequence.every((id) => l.neighbors.some((n) => n.id === id)),
    { message: '正确顺序必须把每个势力刚好排一次', path: ['sequence'] },
  )
  .refine((l) => l.neighbors.some((n) => n.stance === 'attack') && l.neighbors.some((n) => n.stance === 'ally'), {
    message: '既要有"近的"也要有"远的" —— 否则这一计没有取舍',
    path: ['neighbors'],
  });

export type RuseShell = z.infer<typeof RuseShellSchema>;
export type SwapPost = z.infer<typeof SwapPostSchema>;
export type SwapSpare = z.infer<typeof SwapSpareSchema>;
export type SwapLevel = z.infer<typeof SwapLevelSchema>;
export type ChainGate = z.infer<typeof ChainGateSchema>;
export type ChainLevel = z.infer<typeof ChainLevelSchema>;
export type SiegeLog = z.infer<typeof SiegeLogSchema>;
export type SiegeSupportLevel = z.infer<typeof SiegeSupportSchema>;
export type SiegeCloseLevel = z.infer<typeof SiegeCloseSchema>;
export type MatchupNeighbor = z.infer<typeof MatchupNeighborSchema>;
export type MatchupOrderLevel = z.infer<typeof MatchupOrderLevelSchema>;
export type ProbePatch = z.infer<typeof ProbePatchSchema>;
export type ProbeFigure = z.infer<typeof ProbeFigureSchema>;
export type ProbeLevel = z.infer<typeof ProbeLevelSchema>;
export type LureBait = z.infer<typeof LureBaitSchema>;
export type LureOffer = z.infer<typeof LureOfferSchema>;
export type LureReturn = z.infer<typeof LureReturnSchema>;
export type LureLevel = z.infer<typeof LureLevelSchema>;
export type ChaseLevel = z.infer<typeof ChaseLevelSchema>;
export type BorrowFlag = z.infer<typeof BorrowFlagSchema>;
export type BorrowScattered = z.infer<typeof BorrowScatteredSchema>;
export type BorrowBannerLevel = z.infer<typeof BorrowBannerLevelSchema>;
export type ShowSlot = z.infer<typeof ShowSlotSchema>;
export type ShowLevel = z.infer<typeof ShowLevelSchema>;
export type TwolineLevel = z.infer<typeof TwolineLevelSchema>;
export type ReadTell = z.infer<typeof ReadTellSchema>;
export type ReadLevel = z.infer<typeof ReadLevelSchema>;
export type MatchupHorse = z.infer<typeof MatchupHorseSchema>;
export type MatchupRival = z.infer<typeof MatchupRivalSchema>;
export type MatchupLevel = z.infer<typeof MatchupLevelSchema>;
export type RuseItem = z.infer<typeof RuseItemSchema>;
export type RuseNoise = z.infer<typeof RuseNoiseSchema>;
export type RuseLevel = z.infer<typeof RuseLevelSchema>;
export type SiegeVital = z.infer<typeof SiegeVitalSchema>;
export type SiegeLevel = z.infer<typeof SiegeLevelSchema>;
export type BorrowProp = z.infer<typeof BorrowPropSchema>;
export type BorrowLevel = z.infer<typeof BorrowLevelSchema>;
export type StillnessBeat = z.infer<typeof StillnessBeatSchema>;
export type StillnessLevel = z.infer<typeof StillnessLevelSchema>;
export type WindowJob = z.infer<typeof WindowJobSchema>;
export type WindowLevel = z.infer<typeof WindowLevelSchema>;

export type StoneDef = z.infer<typeof StoneSchema>;
export type SubstitutionLevel = z.infer<typeof SubstitutionLevelSchema>;
export type TapMilestone = z.infer<typeof TapMilestoneSchema>;
export type TapLevel = z.infer<typeof TapLevelSchema>;
export type AimTarget = z.infer<typeof AimTargetSchema>;
export type AimRung = z.infer<typeof AimRungSchema>;
export type AimLadder = z.infer<typeof AimLadderSchema>;
export type AimLevel = z.infer<typeof AimLevelSchema>;
export type PlaceSlot = z.infer<typeof PlaceSlotSchema>;
export type PlaceOrb = z.infer<typeof PlaceOrbSchema>;
export type PlaceLevel = z.infer<typeof PlaceLevelSchema>;
export type BeaconTower = z.infer<typeof BeaconTowerSchema>;
export type BeaconLines = z.infer<typeof BeaconLinesSchema>;
export type BeaconLevel = z.infer<typeof BeaconLevelSchema>;
export type WaitTemptation = z.infer<typeof WaitTemptationSchema>;
export type WaitLevel = z.infer<typeof WaitLevelSchema>;
export type TraceAnchor = z.infer<typeof TraceAnchorSchema>;
export type TraceSegment = z.infer<typeof TraceSegmentSchema>;
export type TraceLevel = z.infer<typeof TraceLevelSchema>;
export type SortBin = z.infer<typeof SortBinSchema>;
export type SortItem = z.infer<typeof SortItemSchema>;
export type SortLevel = z.infer<typeof SortLevelSchema>;
export type MarkSurface = z.infer<typeof MarkSurfaceSchema>;
export type MarkLevel = z.infer<typeof MarkLevelSchema>;
export type SplitBin = z.infer<typeof SplitBinSchema>;
export type SplitLevel = z.infer<typeof SplitLevelSchema>;
export type BurrowSpot = z.infer<typeof BurrowSpotSchema>;
export type BurrowWave = z.infer<typeof BurrowWaveSchema>;
export type BurrowLevel = z.infer<typeof BurrowLevelSchema>;
export type ButcherPiece = z.infer<typeof ButcherPieceSchema>;
export type ButcherLines = z.infer<typeof ButcherLinesSchema>;
export type ButcherLevel = z.infer<typeof ButcherLevelSchema>;

/** 模板 id → 关卡脚本 schema。新增模板时在这里登记，content:check 自动生效。 */
export const templateSchemas: Record<string, z.ZodType> = {
  substitution: SubstitutionLevelSchema,
  tap: TapLevelSchema,
  place: PlaceLevelSchema,
  aim: AimLevelSchema,
  sort: SortLevelSchema,
  trace: TraceLevelSchema,
  wait: WaitLevelSchema,
  beacon: BeaconLevelSchema,
  mark: MarkLevelSchema,
  split: SplitLevelSchema,
  burrow: BurrowLevelSchema,
  butcher: ButcherLevelSchema,
  ruse: RuseLevelSchema,
  // siege / matchup 第四辑长出了新模式：老模式那份 schema 一个字没改，这里按并集登记
  siege: z.union([SiegeLevelSchema, SiegeSupportSchema, SiegeCloseSchema]),
  // borrow 有两种模式：force（借刀杀人，既有）与 banner（借尸还魂）——
  // 两份 schema 分开写（force 那份一个字没改），这里按并集登记给构建期体检用。
  borrow: z.union([BorrowLevelSchema, BorrowBannerLevelSchema]),
  stillness: StillnessLevelSchema,
  window: WindowLevelSchema,
  show: ShowLevelSchema,
  twoline: TwolineLevelSchema,
  read: ReadLevelSchema,
  matchup: z.union([MatchupLevelSchema, MatchupOrderLevelSchema]),
  probe: ProbeLevelSchema,
  lure: LureLevelSchema,
  chase: ChaseLevelSchema,
  swap: SwapLevelSchema,
  chain: ChainLevelSchema,
};
