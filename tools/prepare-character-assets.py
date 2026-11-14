#!/usr/bin/env python3
"""将五张角色总表切成统一的 4 方向 / 动作帧图集。

原始素材每张约 262x1199：
- 顶部：一张大立绘
- 下方：4 列 x 8 行小精灵
  行 0-3：下 / 右 / 上 / 左 的四帧行走
  行 4：攻击动作（朝前）
  行 5：受伤（朝前）
  行 6-7：倒地序列（用最后一帧作为倒地）
输出：
- <id>-sheet.png : 320x768，4 列 x 8 行，每帧 80x96
- <id>-portrait.png : 大立绘裁剪
"""
import struct, zlib, os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'character assets'
OUT = ROOT / 'assets' / 'characters' / 'sprites'
OUT.mkdir(parents=True, exist_ok=True)

FILES = {
    'tomori': '高松灯.png',
    'anon': '千早爱音.png',
    'rana': '要乐奈.png',
    'soyo': '长崎爽世.png',
    'taki': '椎名立希.png',
}

# 每个角色每行 3 或 4 帧的横向中心（从原始总表实测）。
# 取窗口时以中心向左右展开，避免把相邻角色的头发带进当前格。
FRAME_CENTERS = {
    'tomori': [55, 119, 183, 246],
    'anon':   [28, 93, 158, 223],
    'rana':   [66, 136, 206],
    'soyo':   [34, 99, 164, 229],
    'taki':   [58, 126, 195],
}

# 小精灵的行区间（含顶部留白，但不切到相邻行）
ROW_BOUNDS = [(300, 412), (412, 524), (524, 636), (636, 742),
              (742, 860), (860, 981), (981, 1091), (1091, 1199)]
CELL_W, CELL_H = 80, 96


def decode_png(path):
    data = Path(path).read_bytes()
    pos = 8
    idat = b''
    w = h = None
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos+4])[0]
        typ = data[pos+4:pos+8]
        chunk = data[pos+8:pos+8+ln]
        pos += 12 + ln
        if typ == b'IHDR':
            w, h, bd, ct, comp, filt, inter = struct.unpack('>IIBBBBB', chunk)
            assert bd == 8 and ct == 6 and inter == 0, (bd, ct, inter)
        elif typ == b'IDAT':
            idat += chunk
        elif typ == b'IEND':
            break
    raw = zlib.decompress(idat)
    stride = w * 4
    out = bytearray(stride * h)
    prev = bytearray(stride)
    for y in range(h):
        f = raw[y * (stride + 1)]
        line = bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        if f == 1:
            for i in range(4, stride):
                line[i] = (line[i] + line[i - 4]) & 255
        elif f == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                a = line[i - 4] if i >= 4 else 0
                line[i] = (line[i] + ((a + prev[i]) // 2)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i - 4] if i >= 4 else 0
                b = prev[i]
                c = prev[i - 4] if i >= 4 else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        out[y * stride:(y + 1) * stride] = line
        prev = line
    return w, h, out


def write_png(path, w, h, rgba):
    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(0)
        raw += rgba[y * stride:(y + 1) * stride]
    def chunk(typ, data):
        return struct.pack('>I', len(data)) + typ + data + struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    png += chunk(b'IEND', b'')
    Path(path).write_bytes(png)


def bbox_alpha(w, h, rgba, x0, y0, x1, y1):
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(y0, min(y1, h)):
        row = y * w
        for x in range(x0, min(x1, w)):
            if rgba[(row + x) * 4 + 3] > 10:
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
    return minx, miny, maxx, maxy

def keep_largest_cell_component(buf, cw, ch):
    """清理 80×96 单元格：只保留最大连通块，去掉窗口边缘带进来的碎发。"""
    seen = bytearray(cw * ch)
    best = []
    for sy in range(ch):
        for sx in range(cw):
            idx = sy * cw + sx
            if seen[idx]:
                continue
            seen[idx] = 1
            if buf[(sy * cw + sx) * 4 + 3] <= 10:
                continue
            stack = [(sx, sy)]
            pixels = []
            while stack:
                x, y = stack.pop()
                pixels.append((x, y))
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if nx < 0 or ny < 0 or nx >= cw or ny >= ch:
                        continue
                    ni = ny * cw + nx
                    if seen[ni]:
                        continue
                    seen[ni] = 1
                    if buf[(ny * cw + nx) * 4 + 3] > 10:
                        stack.append((nx, ny))
            if len(pixels) > len(best):
                best = pixels
    keep = bytearray(cw * ch)
    for x, y in best:
        keep[y * cw + x] = 1
    for sy in range(ch):
        for sx in range(cw):
            if not keep[sy * cw + sx]:
                buf[(sy * cw + sx) * 4:(sy * cw + sx) * 4 + 4] = b'\x00\x00\x00\x00'


def largest_component(w, h, rgba, bx0, by0, bx1, by1):
    """返回裁剪区域内最大的一块不透明连通区域 (mask, bbox, area)。

    原始总表是从角色合影里裁出来的，最左/最右会带进相邻角色的头发。
    按连通域取最大块，可以只保留当前角色，避免编队大头像和动作预览串人。
    """
    bx0, by0 = max(0, bx0), max(0, by0)
    bx1, by1 = min(w, bx1), min(h, by1)
    cw, ch = bx1 - bx0, by1 - by0
    if cw <= 0 or ch <= 0:
        return None, None, 0
    seen = bytearray(cw * ch)
    best = None
    for sy in range(ch):
        for sx in range(cw):
            idx = sy * cw + sx
            if seen[idx]:
                continue
            if rgba[((by0 + sy) * w + bx0 + sx) * 4 + 3] <= 10:
                seen[idx] = 1
                continue
            stack = [(sx, sy)]
            seen[idx] = 1
            pixels = []
            minx = maxx = sx
            miny = maxy = sy
            while stack:
                x, y = stack.pop()
                pixels.append((x, y))
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if nx < 0 or ny < 0 or nx >= cw or ny >= ch:
                        continue
                    ni = ny * cw + nx
                    if seen[ni]:
                        continue
                    seen[ni] = 1
                    if rgba[((by0 + ny) * w + bx0 + nx) * 4 + 3] > 10:
                        stack.append((nx, ny))
            if len(pixels) > (best[2] if best else 0):
                mask = bytearray(cw * ch)
                for px, py in pixels:
                    mask[py * cw + px] = 1
                best = (mask, (bx0 + minx, by0 + miny, bx0 + maxx, by0 + maxy), len(pixels))
    if not best:
        return None, None, 0
    return best


def copy_component(dst, dst_w, dst_h, dst_x, dst_y, src, src_w, bbox, mask, cw, ch, region_x0, region_y0):
    """把连通域按 bbox 裁出，脚底对齐绘制到目标缓冲。"""
    x0, y0, x1, y1 = bbox
    sw, sh = x1 - x0 + 1, y1 - y0 + 1
    for yy in range(sh):
        for xx in range(sw):
            if not mask[(y0 - region_y0 + yy) * cw + (x0 - region_x0 + xx)]:
                continue
            tx, ty = dst_x + xx, dst_y + yy
            if tx < 0 or ty < 0 or tx >= dst_w or ty >= dst_h:
                continue
            si = ((y0 + yy) * src_w + x0 + xx) * 4
            di = (ty * dst_w + tx) * 4
            dst[di:di + 4] = src[si:si + 4]
    return sw, sh


for uid, fname in FILES.items():
    w, h, rgba = decode_png(SRC / fname)
    col_w = w / 4.0

    # 顶部大立绘：若作者提供了去背后的独立立绘，直接使用；
    # 否则从原始总表提取最大连通域，并清理相邻角色残发。
    processed = SRC / 'processed' / f'{uid}.png'
    if processed.exists():
        pw, ph, portrait = decode_png(processed)
    else:
        pmask, pbox, _ = largest_component(w, h, rgba, 0, 0, w, 300)
        if not pbox:
            raise RuntimeError(f'{fname}: portrait not found')
        px0, py0, px1, py1 = pbox
        pw, ph = px1 - px0 + 1, py1 - py0 + 1
        portrait = bytearray(pw * ph * 4)
        for yy in range(ph):
            for xx in range(pw):
                if not pmask[(py0 + yy) * w + (px0 + xx)]:
                    continue
                si = ((py0 + yy) * w + px0 + xx) * 4
                di = (yy * pw + xx) * 4
                portrait[di:di + 4] = rgba[si:si + 4]
        # 原始合影裁切导致个别大立绘贴边：
        # · 千早爱音左侧发梢被切：用右侧发梢镜像补一条完整外轮廓；
        # · 高松灯右侧发梢被切：用左侧外轮廓镜像覆盖右缘，使短发轮廓闭合。
        if px0 <= 0:
            n, overlap = 18, 4
            nw = pw + n - overlap
            padded = bytearray(nw * ph * 4)
            for yy in range(ph):
                for xx in range(pw):
                    si = (yy * pw + xx) * 4
                    di = (yy * nw + xx + n - overlap) * 4
                    padded[di:di+4] = portrait[si:si+4]
                for j in range(n):
                    sx = pw - 1 - j
                    tx = j
                    if tx >= nw:
                        continue
                    si = (yy * pw + sx) * 4
                    di = (yy * nw + tx) * 4
                    if portrait[si+3] > 0:
                        padded[di:di+4] = portrait[si:si+4]
            portrait = padded
            pw = nw
        elif px1 >= w - 1:
            cut = 16
            for yy in range(ph):
                for xx in range(pw - cut, pw):
                    sx = pw - 1 - xx
                    if sx < 0:
                        continue
                    si = (yy * pw + sx) * 4
                    di = (yy * pw + xx) * 4
                    portrait[di:di+4] = portrait[si:si+4]
    write_png(OUT / f'{uid}-portrait.png', pw, ph, portrait)

    big_w, big_h = CELL_W * 4, CELL_H * 8
    big = bytearray(big_w * big_h * 4)
    # 每行先提取 4 个以实测中心展开的窗口；原始素材实际是每行 3 或 4 帧。
    for r, (ry0, ry1) in enumerate(ROW_BOUNDS):
        valid = [False, False, False, False]
        centers = FRAME_CENTERS[uid]
        edges = [0] + [(centers[i] + centers[i + 1]) // 2 for i in range(len(centers) - 1)] + [w]
        for c, center in enumerate(centers):
            cx0 = edges[c]
            cx1 = edges[c + 1]
            mask, box, area = largest_component(w, h, rgba, cx0, ry0, cx1, ry1)
            if not box or (box[2] - box[0] + 1) < 18 or area < 180:
                continue
            x0, y0, x1, y1 = box
            sw, sh = x1 - x0 + 1, y1 - y0 + 1
            dst_x = (CELL_W - sw) // 2
            dst_y = CELL_H - 2 - sh
            cell_buf = bytearray(CELL_W * CELL_H * 4)
            copy_component(cell_buf, CELL_W, CELL_H, dst_x, dst_y,
                           rgba, w, box, mask, cx1 - cx0, ry1 - ry0, cx0, ry0)
            keep_largest_cell_component(cell_buf, CELL_W, CELL_H)
            # 清掉窗口边缘残留的相邻角色头发；角色本身居中，留有足够透明边距。
            for yy in range(CELL_H):
                for xx in list(range(13)) + list(range(CELL_W - 13, CELL_W)):
                    off = (yy * CELL_W + xx) * 4
                    cell_buf[off:off + 4] = b'\x00\x00\x00\x00'
            for yy in range(CELL_H):
                dst_off = ((r * CELL_H + yy) * big_w + c * CELL_W) * 4
                big[dst_off:dst_off + CELL_W * 4] = cell_buf[yy * CELL_W * 4:(yy + 1) * CELL_W * 4]
            valid[c] = True
        # Taki 等角色只有 3 帧，第 4 格是相邻角色的残片；复制第 3 帧作为循环帧。
        if not valid[3] and valid[2]:
            for yy in range(CELL_H):
                src_off = ((r * CELL_H + yy) * big_w + 2 * CELL_W) * 4
                dst_off = ((r * CELL_H + yy) * big_w + 3 * CELL_W) * 4
                big[dst_off:dst_off + CELL_W * 4] = big[src_off:src_off + CELL_W * 4]
    write_png(OUT / f'{uid}-sheet.png', big_w, big_h, big)

    # 倒地：从受伤帧 c0 的最大连通域旋转 90°，避免原始第 7 行中站姿与躺姿粘连。
    cell_x0, cell_x1 = 0, FRAME_CENTERS[uid][0] + 36
    hmask, hbox, _ = largest_component(w, h, rgba, cell_x0, 860, cell_x1, 981)
    hx0, hy0, hx1b, hy1 = hbox
    hw, hh = hx1b - hx0 + 1, hy1 - hy0 + 1
    dw, dh = hh + 2, hw + 2
    down = bytearray(dw * dh * 4)
    for sy in range(hh):
        for sx in range(hw):
            if not hmask[sy * (cell_x1 - cell_x0) + (hx0 - cell_x0 + sx)]:
                continue
            si = ((hy0 + sy) * w + hx0 + sx) * 4
            dx, dy = dw - 3 - sy, sx + 1
            di = (dy * dw + dx) * 4
            down[di:di + 4] = rgba[si:si + 4]
    write_png(OUT / f'{uid}-down.png', dw, dh, down)
    print(uid, 'portrait', pw, ph, 'sheet', big_w, big_h)
