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
};
