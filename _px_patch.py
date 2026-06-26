# -*- coding: utf-8 -*-
import io, py_compile, sys

PATH = r"d:\User\70641\Documents\SCE Projects\game_entry_0\tools\sprite\server.py"

OLD_GRID = '''    columns = max(1, sheet_columns or round(math.sqrt(len(copied_paths))))
    rows = math.ceil(len(copied_paths) / columns)
    sheet = Image.new("RGBA", (columns * cell_width, rows * cell_height), (0, 0, 0, 0))
    for index, frame_path in enumerate(copied_paths):
        row = index // columns
        column = index % columns
        frame = open_rgba_image(frame_path)
        frame_width, frame_height = frame_sizes[index]
        offset_x = column * cell_width + (cell_width - frame_width) // 2
        offset_y = row * cell_height + (cell_height - frame_height) // 2
        sheet.paste(frame, (offset_x, offset_y), frame)
        frame.close()
'''

NEW_GRID = '''    columns = max(1, sheet_columns or round(math.sqrt(len(copied_paths))))
    rows = math.ceil(len(copied_paths) / columns)
    padding = 2
    sheet = None
    sheet_layout = "grid"
    frame_positions: list[dict] = []

    # 优先用 rectpack 做紧凑装箱；任何环节异常都回退到规则网格，保证一定能出图，
    # 且 columns / sheet / frame_positions 等变量在所有分支下都必然已绑定。
    if HAS_RECTPACK and len(copied_paths) > 1:
        try:
            max_w = max(w for w, _ in frame_sizes) + padding
            max_h = max(h for _, h in frame_sizes) + padding
            best_sheet = None
            best_rects = None
            for cols in range(1, len(copied_paths) + 1):
                grid_rows = math.ceil(len(copied_paths) / cols)
                bin_w = max(cols * cell_width + padding * cols, max_w)
                bin_h = max(grid_rows * cell_height + padding * grid_rows, max_h)
                test_packer = newPacker(mode=1, bin_algo=2, pack_algo=MaxRectsBssf, rotation=False)
                for idx, (w, h) in enumerate(frame_sizes):
                    test_packer.add_rect(w + padding, h + padding, idx)
                test_packer.add_bin(bin_w, bin_h)
                test_packer.pack()
                if len(test_packer[0]) == len(copied_paths):
                    if best_sheet is None or (bin_w * bin_h < best_sheet[0] * best_sheet[1]):
                        best_sheet = (bin_w, bin_h)
                        best_rects = list(test_packer[0])
            if best_sheet and best_rects:
                packed_sheet = Image.new("RGBA", best_sheet, (0, 0, 0, 0))
                ordered: list[dict | None] = [None] * len(copied_paths)
                for rect in best_rects:
                    idx = rect.rid
                    frame = open_rgba_image(copied_paths[idx])
                    packed_sheet.paste(frame, (rect.x, rect.y), frame)
                    frame.close()
                    fw, fh = frame_sizes[idx]
                    ordered[idx] = {"index": idx, "x": rect.x, "y": rect.y, "width": fw, "height": fh}
                sheet = packed_sheet
                sheet_layout = "packed"
                frame_positions = [pos for pos in ordered if pos is not None]
        except Exception as exc:
            print(f"[export] rectpack packing failed, fallback to grid: {exc}")
            sheet = None
            sheet_layout = "grid"
            frame_positions = []

    if sheet is None:
        sheet = Image.new("RGBA", (columns * cell_width, rows * cell_height), (0, 0, 0, 0))
        sheet_layout = "grid"
        frame_positions = []
        for index, frame_path in enumerate(copied_paths):
            row = index // columns
            column = index % columns
            frame = open_rgba_image(frame_path)
            frame_width, frame_height = frame_sizes[index]
            offset_x = column * cell_width + (cell_width - frame_width) // 2
            offset_y = row * cell_height + (cell_height - frame_height) // 2
            sheet.paste(frame, (offset_x, offset_y), frame)
            frame.close()
            frame_positions.append({"index": index, "x": offset_x, "y": offset_y, "width": frame_width, "height": frame_height})
    unscaled_sheet_size = sheet.size
'''

OLD_MANIFEST = '''        "sheet_columns": columns,
        "cell_width": cell_width,
        "cell_height": cell_height,
'''

NEW_MANIFEST = '''        "sheet_columns": columns,
        "cell_width": cell_width,
        "cell_height": cell_height,
        "sheet_layout": sheet_layout,
        "unscaled_sheet_width": unscaled_sheet_size[0],
        "unscaled_sheet_height": unscaled_sheet_size[1],
        "frames": frame_positions,
'''

with io.open(PATH, "rb") as f:
    raw = f.read()
orig_nl = "\r\n" if b"\r\n" in raw else "\n"
print("orig newline:", repr(orig_nl))

with io.open(PATH, "r", encoding="utf-8") as f:
    src = f.read()

n1 = src.count(OLD_GRID)
n2 = src.count(OLD_MANIFEST)
print("grid-block occurrences:", n1)
print("manifest-block occurrences:", n2)
assert n1 == 1, "OLD_GRID must match exactly once"
assert n2 == 1, "OLD_MANIFEST must match exactly once"
assert "rectpack" not in src.split("def export_job", 1)[1].split("def env_check_payload", 1)[0], "export_job already contains rectpack?"

src = src.replace(OLD_GRID, NEW_GRID, 1)
src = src.replace(OLD_MANIFEST, NEW_MANIFEST, 1)

with io.open(PATH, "w", encoding="utf-8", newline=orig_nl) as f:
    f.write(src)

py_compile.compile(PATH, doraise=True)
print("OK: patched and compiled")
