# -*- coding: utf-8 -*-
"""
Generate Pixel-Isolated, High-Craft Luminous Silk Embroidered Motif Textures
Reads public/embroidery_motifs.png and splits it into 11 isolated, clean motif pairs:
- motif_{id}_lineart.png (clean isolated outline with 0 bleed)
- motif_{id}_embroidered.png (exquisite luminous silk embroidery artwork with airy silk sheen & soft aura)
"""

import math
import json
import os
from collections import deque
from PIL import Image, ImageFilter, ImageDraw

def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip('#')
    return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))

MOTIF_SPECS = [
    {
        'id': 1,
        'name': '心形礼盒',
        'theme_color': '#f43f5e',
        'stitch_color': '#f43f5e',
        'fill_color': '#ffe4e6',
        'gold_color': '#fef08a'
    },
    {
        'id': 2,
        'name': '玫瑰花篮',
        'theme_color': '#10b981',
        'stitch_color': '#10b981',
        'fill_color': '#d1fae5',
        'gold_color': '#fef08a'
    },
    {
        'id': 3,
        'name': '方形礼盒',
        'theme_color': '#a855f7',
        'stitch_color': '#a855f7',
        'fill_color': '#f3e8ff',
        'gold_color': '#fef08a'
    },
    {
        'id': 4,
        'name': '小熊花篮',
        'theme_color': '#f59e0b',
        'stitch_color': '#f59e0b',
        'fill_color': '#fef3c7',
        'gold_color': '#fef08a'
    },
    {
        'id': 5,
        'name': '爱心情书',
        'theme_color': '#ef4444',
        'stitch_color': '#ef4444',
        'fill_color': '#fee2e2',
        'gold_color': '#fef08a'
    },
    {
        'id': 6,
        'name': '羽翼小熊',
        'theme_color': '#f97316',
        'stitch_color': '#f97316',
        'fill_color': '#ffedd5',
        'gold_color': '#fef08a'
    },
    {
        'id': 7,
        'name': '玫瑰手捧花',
        'theme_color': '#ea580c',
        'stitch_color': '#ea580c',
        'fill_color': '#ffedd5',
        'gold_color': '#fef08a'
    },
    {
        'id': 8,
        'name': '心形巧克力',
        'theme_color': '#e11d48',
        'stitch_color': '#e11d48',
        'fill_color': '#ffe4e6',
        'gold_color': '#fef08a'
    },
    {
        'id': 9,
        'name': '福袋礼包',
        'theme_color': '#0284c7',
        'stitch_color': '#0284c7',
        'fill_color': '#e0f2fe',
        'gold_color': '#fef08a'
    },
    {
        'id': 10,
        'name': '小熊挂件',
        'theme_color': '#d97706',
        'stitch_color': '#d97706',
        'fill_color': '#fef3c7',
        'gold_color': '#fef08a'
    },
    {
        'id': 11,
        'name': '玫瑰蛋糕',
        'theme_color': '#ec4899',
        'stitch_color': '#ec4899',
        'fill_color': '#fce7f3',
        'gold_color': '#fef08a'
    },
]

def filter_noise_components(pts_dict, min_size=40):
    """Filter out stray noise components with < min_size pixels."""
    visited = set()
    valid_pts = {}

    for (x, y), rgba in pts_dict.items():
        if (x, y) not in visited:
            q = deque([(x, y)])
            visited.add((x, y))
            comp = []
            while q:
                cx, cy = q.popleft()
                comp.append(((cx, cy), pts_dict[(cx, cy)]))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        if dx == 0 and dy == 0: continue
                        nx, ny = cx + dx, cy + dy
                        if (nx, ny) in pts_dict and (nx, ny) not in visited:
                            visited.add((nx, ny))
                            q.append((nx, ny))
            if len(comp) >= min_size:
                for p, val in comp:
                    valid_pts[p] = val

    return valid_pts if valid_pts else pts_dict

def generate():
    im = Image.open('public/embroidery_motifs.png').convert('RGBA')
    w_full, h_full = im.size
    pix_full = im.load()
    cx, cy = 540, 1033

    os.makedirs('public/motifs', exist_ok=True)
    metadata = []

    scaleX = 4.4386 / 1080.0
    scaleY = 7.8909 / 1920.0

    # 1. Classify every pixel of the full image with the mathematically verified separator
    label_map = {}
    for y in range(400, 1650):
        for x in range(20, 1060):
            a = pix_full[x, y][3]
            if a > 20:
                ang = math.degrees(math.atan2(y - cy, x - cx))
                clock = (ang + 90) % 360

                # Strict boundary separation between Motif 2 (Rose Basket) and Motif 3 (Square Box)
                if 40 <= clock <= 65 and 700 <= y <= 850 and 750 <= x <= 1040:
                    if y >= 796:
                        mid = 3
                    elif y < 770:
                        mid = 2
                    else:
                        t = (y - 770) / (796 - 770)
                        sep_x = 885 + t * (866 - 885)
                        mid = 3 if x >= sep_x else 2
                else:
                    if clock >= 345 or clock < 15: mid = 1
                    elif 15 <= clock < 50.5: mid = 2
                    elif 50.5 <= clock < 82: mid = 3
                    elif 82 <= clock < 118: mid = 4
                    elif 118 <= clock < 145: mid = 5
                    elif 145 <= clock < 178: mid = 6
                    elif 178 <= clock < 215: mid = 7
                    elif 215 <= clock < 245: mid = 8
                    elif 245 <= clock < 280: mid = 9
                    elif 280 <= clock < 308: mid = 10
                    elif 308 <= clock < 345: mid = 11
                    else: mid = 1

                label_map[(x, y)] = mid

    # 2. Build isolated lineart and luminous embroidered textures for all 11 motifs
    for spec in MOTIF_SPECS:
        mid = spec['id']
        name = spec['name']

        raw_pts = {(x, y): pix_full[x, y] for (x, y), l_id in label_map.items() if l_id == mid}
        if not raw_pts:
            print(f'Warning: No pixels found for motif {mid}')
            continue

        # Filter stray disconnected dust specks
        pts_dict = filter_noise_components(raw_pts, min_size=40)
        pts = [(x, y, rgba) for (x, y), rgba in pts_dict.items()]

        min_x = min(p[0] for p in pts) - 6
        max_x = max(p[0] for p in pts) + 6
        min_y = min(p[1] for p in pts) - 6
        max_y = max(p[1] for p in pts) + 6

        w = max_x - min_x + 1
        h = max_y - min_y + 1

        tot_a = sum(p[2][3] for p in pts)
        mean_x = sum(p[0] * p[2][3] for p in pts) / tot_a
        mean_y = sum(p[1] * p[2][3] for p in pts) / tot_a

        # 2.1. Isolated lineart
        lineart = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        l_pix = lineart.load()
        for x, y, rgba in pts:
            l_pix[x - min_x, y - min_y] = rgba

        lineart_path = f'public/motifs/motif_{mid}_lineart.png'
        lineart.save(lineart_path)

        # 2.2. Luminous silk embroidery artwork
        r, g, b, a = lineart.split()
        dilated = a.filter(ImageFilter.MaxFilter(7))
        fill_mask = dilated.filter(ImageFilter.GaussianBlur(1.2))

        s_rgb = hex_to_rgb(spec['stitch_color'])
        f_rgb = hex_to_rgb(spec['fill_color'])
        g_rgb = hex_to_rgb(spec['gold_color'])

        # 2.2.1. Soft luminous aura (gentle, airy)
        aura_mask = fill_mask.filter(ImageFilter.GaussianBlur(5.0))
        aura = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        for y_i in range(h):
            for x_i in range(w):
                am = aura_mask.getpixel((x_i, y_i))
                if am > 10:
                    aura.putpixel((x_i, y_i), (s_rgb[0], s_rgb[1], s_rgb[2], int(am * 0.35)))

        # 2.2.2. Translucent, bright silk fill
        silk_layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        for y_i in range(h):
            for x_i in range(w):
                m_val = fill_mask.getpixel((x_i, y_i))
                if m_val > 15:
                    dist_cx = abs(x_i - w / 2) / (w / 2)
                    dist_cy = abs(y_i - h / 2) / (h / 2)
                    pillow = max(0.0, 1.0 - math.hypot(dist_cx, dist_cy) * 0.5)

                    cr = int(f_rgb[0] * 0.85 + g_rgb[0] * 0.15 * pillow)
                    cg = int(f_rgb[1] * 0.85 + g_rgb[1] * 0.15 * pillow)
                    cb = int(f_rgb[2] * 0.85 + g_rgb[2] * 0.15 * pillow)
                    silk_layer.putpixel((x_i, y_i), (min(255, cr), min(255, cg), min(255, cb), int(m_val * 0.38)))

        # 2.2.3. Luminous silk stitches with gold highlights
        enhanced_lines = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        for y_i in range(h):
            for x_i in range(w):
                orig = l_pix[x_i, y_i]
                if orig[3] > 15:
                    shimmer = (math.sin((x_i * 0.25 + y_i * 0.35)) * 0.5 + 0.5) * 0.30
                    sr = int(s_rgb[0] * (1.0 - shimmer) + g_rgb[0] * shimmer)
                    sg = int(s_rgb[1] * (1.0 - shimmer) + g_rgb[1] * shimmer)
                    sb = int(s_rgb[2] * (1.0 - shimmer) + g_rgb[2] * shimmer)
                    enhanced_lines.putpixel((x_i, y_i), (min(255, sr), min(255, sg), min(255, sb), orig[3]))

        # Composite layers
        embroidered = Image.alpha_composite(aura, silk_layer)
        embroidered = Image.alpha_composite(embroidered, enhanced_lines)

        # 2.2.4. Starry sparkles (bright 4-point cross stars)
        draw = ImageDraw.Draw(embroidered)
        sparkles = [
            (int(w * 0.22), int(h * 0.25)),
            (int(w * 0.78), int(h * 0.22)),
            (int(w * 0.80), int(h * 0.78)),
            (int(w * 0.20), int(h * 0.75)),
        ]
        for sx, sy in sparkles:
            if 10 <= sx < w - 10 and 10 <= sy < h - 10 and fill_mask.getpixel((sx, sy)) > 50:
                for d in range(1, 6):
                    alpha = int(255 * (1.0 - d / 6.0))
                    draw.point((sx + d, sy), fill=(255, 255, 230, alpha))
                    draw.point((sx - d, sy), fill=(255, 255, 230, alpha))
                    draw.point((sx, sy + d), fill=(255, 255, 230, alpha))
                    draw.point((sx, sy - d), fill=(255, 255, 230, alpha))
                draw.ellipse((sx - 1, sy - 1, sx + 1, sy + 1), fill=(255, 255, 255, 255))

        embroidered_path = f'public/motifs/motif_{mid}_embroidered.png'
        embroidered.save(embroidered_path)

        # Three.js world coordinates
        wx = (mean_x - 540) * scaleX
        wy = (960 - mean_y) * scaleY

        entry = {
            'id': mid,
            'name': name,
            'px': round(mean_x, 1),
            'py': round(mean_y, 1),
            'wx': round(wx, 4),
            'wy': round(wy, 4),
            'bbox': [min_x, min_y, max_x, max_y],
            'size': [w, h],
            'theme_color': spec['theme_color'],
            'lineart_url': f'./motifs/motif_{mid}_lineart.png',
            'embroidered_url': f'./motifs/motif_{mid}_embroidered.png'
        }
        metadata.append(entry)
        print(f'Generated motif {mid:2d}: {name} ({w}x{h}) at ({mean_x:.1f}, {mean_y:.1f})')

    with open('public/motifs/metadata.json', 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)

    print('All 11 luminous motifs generated successfully!')

if __name__ == '__main__':
    generate()
