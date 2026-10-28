"""生成应用图标与启动图。

刻意用几何图形画：和游戏内的美术保持一致（圆润卡通 + 传统色），
而且不引入任何需要授权的素材。
"""

import os
from PIL import Image, ImageDraw

S = 1024
RED = (224, 85, 74, 255)
RED_DEEP = (176, 58, 49, 255)
INK = (58, 47, 38, 255)
PAPER = (253, 243, 220, 255)
WOOD = (201, 138, 75, 255)
WATER = (89, 171, 218, 255)
WATER_DEEP = (50, 131, 179, 255)
GOLD = (242, 177, 52, 255)


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    u = size / 1024.0

    def box(x0, y0, x1, y1):
        return [x0 * u, y0 * u, x1 * u, y1 * u]

    def w(v):
        return max(1, int(v * u))

    # 朱红圆角方底
    d.rounded_rectangle(box(0, 0, 1023, 1023), radius=int(220 * u), fill=RED, outline=INK, width=w(18))
    # 内嵌的"天空"面板
    d.rounded_rectangle(box(112, 130, 912, 792), radius=int(96 * u), fill=PAPER, outline=INK, width=w(14))
    # 太阳
    d.ellipse(box(636, 196, 812, 372), fill=GOLD, outline=INK, width=w(12))
    # 水
    d.rounded_rectangle(box(112, 560, 912, 792), radius=int(40 * u), fill=WATER)
    d.rounded_rectangle(box(112, 700, 912, 792), radius=int(40 * u), fill=WATER_DEEP)
    # 船身
    d.rounded_rectangle(box(238, 440, 786, 606), radius=int(72 * u), fill=WOOD, outline=INK, width=w(14))
    # 甲板
    d.rounded_rectangle(box(258, 420, 766, 470), radius=int(24 * u), fill=(224, 165, 105, 255), outline=INK, width=w(10))
    # 红色水痕 —— 整个典故的关键
    d.rectangle(box(180, 578, 844, 606), fill=RED_DEEP)
    # 船上三块石头
    for cx, r in ((400, 44), (500, 34), (578, 26)):
        d.ellipse(box(cx - r, 400 - r, cx + r, 400 + r), fill=(174, 170, 162, 255), outline=INK, width=w(10))
    return img


def main() -> None:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    icon = draw_icon(S)

    targets = [
        os.path.join(root, "apps", "desktop", "src-tauri", "icon-source.png"),
        os.path.join(root, "apps", "mobile", "resources", "icon.png"),
        os.path.join(root, "apps", "mobile", "resources", "icon-only.png"),
        os.path.join(root, "apps", "mobile", "resources", "icon-foreground.png"),
    ]
    for path in targets:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        icon.save(path)
        print("icon  ->", path)

    # 启动图：纸色底 + 居中图标（Android 需要方形，避免被裁）
    splash = Image.new("RGBA", (2732, 2732), PAPER)
    small = icon.resize((1100, 1100), Image.LANCZOS)
    splash.paste(small, ((2732 - 1100) // 2, (2732 - 1100) // 2), small)
    splash_path = os.path.join(root, "apps", "mobile", "resources", "splash.png")
    splash.save(splash_path)
    print("splash->", splash_path)


if __name__ == "__main__":
    main()
