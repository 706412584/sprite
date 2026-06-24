# Sprite Video Lab Usage Guide

Languages: [English](./USAGE.md) | [简体中文](./USAGE.zh-CN.md)

This guide walks through the full Sprite Video Lab workflow: importing media, trimming a useful range, choosing a matting mode, tuning edges, previewing animation, and exporting transparent sprite assets. The app runs locally. Your source media, temporary files, preview outputs, jobs, and exports stay on your own machine.

## What It Is Good For

Sprite Video Lab is designed for turning video clips or still images into 2D game-ready sprite assets.

It works especially well for:

- Green-screen, blue-screen, or solid-background character actions.
- AI-generated videos of characters, props, buildings, or effects.
- Fire, lightning, glow, particles, and other VFX that need bright translucent areas preserved.
- Wide attack trails, slash effects, dash trails, and multi-pose strips.
- Existing transparent PNGs that only need resizing, alignment, frame selection, and packing.

Supported input formats:

- Video: `mp4`, `mov`, `mkv`, `webm`
- Image: `png`, `jpg`, `jpeg`, `webp`, `bmp`

## Install And Start

### 1. Install The Base Runtime

Use Python 3.10 or newer. In the project folder:

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

The base runtime is enough for solid-color keying, frame extraction, resizing, alignment, and export. You do not need the AI dependencies unless you want BiRefNet or CorridorKey.

### 2. Install ffmpeg

Video import and extraction need `ffmpeg` and `ffprobe`. The easiest setup is to put both on `PATH`.

If you keep ffmpeg in a standalone folder, point the app to it before launch:

```powershell
$env:SPRITE_VIDEO_LAB_FFMPEG_DIR="D:\ffmpeg\bin"
```

### 3. Optional: Install The AI Matting Runtime

To use BiRefNet or CorridorKey, run:

```bat
setup_ai_runtime.bat
```

The script installs AI dependencies and prepares CorridorKey when possible. The first AI run may download model files, so it can take longer than later runs.

Useful environment variables:

```bat
set SPRITE_VIDEO_LAB_AI_MODEL_CACHE=E:\sprite-video-lab-models\huggingface
set SPRITE_VIDEO_LAB_CORRIDORKEY_ROOT=E:\sprite-video-lab-models\CorridorKey
set SPRITE_VIDEO_LAB_PYTHON=C:\path\to\python.exe
```

See [AI_MATTING.md](./AI_MATTING.md) for more AI setup details.

### 4. Start The App

#### Local Development / Testing

When developing the React UI, start the source backend and Vite separately:

```powershell
npm run dev:api   # Python API: http://127.0.0.1:8895
npm run dev       # React/Vite UI: http://127.0.0.1:39200
```

Local testing uses `8895`, so it does not accidentally connect to the Windows desktop backend on `8894`.

#### Windows Desktop / Packaged Build

On Windows, run:

```bat
start_sprite_video_lab.bat
```

Or start it manually:

```powershell
python server.py
```

Default URL:

```text
http://127.0.0.1:8894
```

The Windows desktop and packaged builds use `8894`. To override it manually:

```powershell
python server.py --host 127.0.0.1 --port 8895
```

## The Four-Step Workflow

The UI is organized into four steps: import media, preview and trim, extract and matte, then review and export.

### Step 1: Import Media

You can import media in two ways:

- Paste a full local video/image path and click `Import Path`.
- Drag a file into the upload area, or click the upload area and choose a file.

After import, the app shows the media name, resolution, frame rate, and duration. Images are treated as single-frame sources.

Tips:

- Full local paths are best, especially when folders contain spaces or non-ASCII characters.
- For very large videos, trim roughly in a video editor first. A shorter source clip saves processing time.
- If your PNG already has transparency, use `No matting` or disable background removal and only normalize/export it.

### Step 2: Preview And Trim

For video sources, the preview panel shows a player. Scrub the player, then adjust `Start frame` and `End frame`.

The selected range is live. You do not need to confirm it separately; Step 3 uses the current range directly.

Tips:

- Put the start frame 1-2 frames before the action begins so the first motion is not clipped.
- Put the end frame after the action fully settles; extra static frames can be removed in Step 4.
- For short actions, set `Keep every N frames` to `1` first to avoid sampling too sparsely.

## Step 3: Extract Frames And Matte

This step controls frame count, output size, canvas layout, alignment, and matting quality. The recommended flow is to click `Preview current frame` first, tune settings, and only then click `Start processing`.

### Keep Every N Frames

This controls sampling density:

- `1`: keep every frame. Smoothest animation, largest output.
- `2`: keep every other frame. A common default.
- `3` or higher: useful for high-FPS source videos or slow motion.

If the exported animation feels jumpy, lower this value.

### Target Height

The app scales the sprite so the output content fits the target height.

Common values:

- Small pixel-art characters: `64`, `96`, `128`
- Medium character actions: `192`, `256`
- Large VFX or high-resolution assets: `512` and above

Larger target heights increase processing time and file size.

### Canvas Layout

Canvas layout controls each PNG frame's dimensions and where the subject sits.

- `Auto width centered`: best for wide attacks, trails, VFX strips, and horizontal motion.
- `Square bottom aligned`: best for characters with a ground contact point.
- `Square centered`: best for icons, magic orbs, explosions, and effects without a ground baseline.

If the character appears to jump around in animation preview, increase padding or switch to a square layout.

### Canvas Padding

Padding adds extra transparent space around the subject.

Typical ranges:

- Normal characters: `8` to `16`
- Attacks and weapon swings: `16` to `32`
- Large glow, particles, explosions: `32` or more

Too little padding clips motion. Too much padding wastes sprite sheet space.

## Choosing A Matting Mode

### No Matting

No background removal. The app only rescales, aligns, and exports. Use this for transparent PNGs or when you only need extraction and packing.

### Solid Color / Green Screen

Fast color keying for green screen, blue screen, white background, black background, or any controlled solid background.

Important controls:

- Key color mode: sample corners automatically, or choose a manual background color.
- Threshold: higher values remove more pixels near the background color.
- Softness: higher values make the alpha edge smoother.
- Despill strength: reduces green/blue color contamination near edges.
- Halo shrink pixels: contracts the alpha edge to remove dirty outlines.

Recommended tuning order:

1. Make sure the background color is sampled correctly.
2. Adjust threshold until most of the background disappears.
3. Adjust softness until the edge feels natural.
4. Add despill and halo shrink to clean green/blue/white edges.

### BiRefNet

AI subject matting for uneven backgrounds, generated backgrounds, and real-world environments. It predicts a subject alpha matte semantically.

Good for:

- Characters, monsters, buildings, props, and other clear subjects.
- Sources where solid-color keying cannot isolate the subject.

Less ideal for:

- Heavy translucent particles or glow trails.
- Frames where the subject blends semantically with the background.
- Effects where every flame, spark, or lightning trail must be preserved.

### BiRefNet + Luma

Combines BiRefNet subject alpha with a brightness-based alpha. It helps preserve bright glow, fire, lightning, and particles while still protecting the main subject.

Good for:

- VFX sprites.
- Magic, fire, explosions, lightning.
- AI-generated glowing characters, buildings, or props.

Main controls:

- Luma black point: darker pixels below this are more likely to become transparent.
- Luma white point: brighter pixels above this are more likely to be preserved.
- Luma gamma: changes the brightness transition curve.
- Luma strength: controls how strongly brightness contributes to final alpha.

Tuning direction:

- Bright effects disappear: lower Luma white point or raise Luma strength.
- Too much dark residue remains: raise Luma black point.
- Glow edge is too harsh: adjust Gamma and softness.
- Interior subject areas become semi-transparent: use a subject-protection preset.

## Subject-Protection Presets

Subject-protection presets are shortcuts for `BiRefNet + Luma`. They help keep buildings, characters, props, and interior details from becoming semi-transparent.

Presets:

- `Soft`: conservative protection for small transparency issues.
- `Balanced`: the usual starting point, balancing subject integrity with glow preservation.
- `Strong`: prioritizes subject preservation when building interiors, armor, or dark structure are being cut away.

Clicking a preset automatically:

- Enables background removal.
- Switches to `BiRefNet + Luma`.
- Disables CorridorKey.
- Sets Halo to `0`.
- Raises AI edge resolution.
- Applies a tuned group of Luma settings.

Recommended use:

1. Move to the frame most likely to fail.
2. Click `Preview current frame`.
3. If the subject interior is transparent, click a preset.
4. Preview again and compare.
5. Process the full range only after the preview looks right.

## CorridorKey Refinement

CorridorKey is for green-screen and blue-screen plates. It reconstructs cleaner foreground color and alpha around edges.

Good for:

- True green/blue screen footage.
- Mostly correct alpha with remaining green/blue contamination.
- Semi-transparent edges, hair, soft light rims, and similar edge detail.

Avoid it for:

- Non-screen backgrounds.
- Effects dominated by glow particles.
- VFX workflows already using `BiRefNet + Luma`.

For very large images, Sprite Video Lab uses a safer large-frame handling path to reduce GPU post-processing risk.

## Complete AI Matting Guide

This section is written for day-to-day use. You do not need to understand the model internals. Start by identifying the kind of source you have, then follow the matching workflow.

### Which Mode Should I Pick First?

| Source type | Recommended mode | Avoid |
| --- | --- | --- |
| Pure green screen, blue screen, white background, or black background | `Solid color / green screen` | Starting with BiRefNet, which is slower and not always cleaner for controlled screens |
| Real background, AI background, uneven background, clear subject | `BiRefNet` | CorridorKey, because it is only for green/blue screens |
| Fire, lightning, explosions, glow particles, magic trails | `BiRefNet + Luma` | Plain BiRefNet, which may remove bright trails as background |
| Building, character, or prop interiors become semi-transparent | `BiRefNet + Luma` plus a subject-protection preset | Increasing Halo, which can damage the subject more |
| Green/blue screen edge has visible color contamination | `Solid color` or `BiRefNet`, then enable CorridorKey | Using Luma to solve screen spill |
| Already transparent PNG | `No matting` | Re-matting with AI, which can damage the original alpha |

### How To Use BiRefNet

BiRefNet is the "find the subject" AI mode. Use it when the subject is clear but the background is complex: AI-generated characters, monsters, buildings, props, portraits, and similar assets.

Steps:

1. In Step 3, enable background removal.
2. Set Matting mode to `BiRefNet`.
3. For the BiRefNet model, start with `BiRefNet HR-matting`; use `lite-2K` only when memory or speed is tight.
4. Keep AI device on `auto`; switch to `cpu` only if GPU fails.
5. Set AI edge resolution to `1024` first. Try `1536`, `2048`, or `2560` if edges need more detail.
6. Move to the hardest frame and click `Preview current frame`.
7. If the subject is complete and the edge is acceptable, click `Start processing`.

BiRefNet tuning:

| Symptom | What to change |
| --- | --- |
| Edge is blurry, hair or contour detail is missing | Raise AI edge resolution, for example from `1024` to `2048` |
| Processing is too slow or runs out of memory | Lower AI edge resolution, use `lite-2K`, or switch device to `cpu` |
| Holes appear inside the subject | Use `BiRefNet + Luma`, then apply a subject-protection preset |
| Glow, fire, lightning trails disappear | Use `BiRefNet + Luma` |
| Large background areas remain | Check the selected frame/range first; if subject and background are visually mixed, try another preview frame or use solid-color keying |

### How To Use BiRefNet + Luma

`BiRefNet + Luma` means "subject matte plus brightness preservation." It is the best starting point for VFX: fire, lightning, explosions, rings, particles, and magic trails. Plain BiRefNet may remove those bright trails as background; Luma brings bright regions back into the alpha.

Steps:

1. Set Matting mode to `BiRefNet + Luma`.
2. Set Halo to `0` first so glow edges are not contracted.
3. Leave CorridorKey off unless the source is a true green/blue screen.
4. Set AI edge resolution to `1024` or `1536`; try `2048` for high-resolution VFX.
5. Click `Preview current frame`.
6. Tune Luma black point, white point, gamma, and strength from the preview.
7. Process the full range only after the preview is good.

The four Luma controls:

| Control | What it means | Raising it | Lowering it |
| --- | --- | --- | --- |
| Luma black point | How dark a pixel can be before it fades out | Removes more dark residue, but may eat dark detail | Keeps more dark detail, but may keep background dirt |
| Luma white point | How bright a pixel must be to be strongly preserved | Preserves only brighter effects, cleaner result | Preserves more glow and pale regions |
| Luma Gamma | Brightness transition curve | Can keep softer mid-bright glow | Can make the transition harder for high-contrast effects |
| Luma strength | How much Luma affects final alpha | More complete glow, but more bright background residue | Cleaner background, more reliance on BiRefNet alpha |

Good starting points:

- Mild glowing character: white point `110`, Gamma `0.7`, strength `1.3`
- Magic/fire: white point `85`, Gamma `0.55`, strength `1.7`
- Strong lightning/explosion: white point `65`, Gamma `0.45`, strength `2.0`

Common symptoms:

| Symptom | What to change |
| --- | --- |
| Fire or lightning is incomplete | Lower Luma white point, or raise Luma strength |
| Too many bright background dots remain | Raise Luma black point, or lower Luma strength |
| Subject interior becomes transparent | Use the `Balanced` or `Strong` subject-protection preset |
| Glow edge is cut too hard | Set Halo to `0`, raise softness, and adjust Gamma |
| Result becomes a bright foggy blob | Raise Luma black point, lower Luma strength, or switch back to BiRefNet |

### How To Pick A Subject-Protection Preset

Subject-protection presets are made for `BiRefNet + Luma`. They are not for general cleanup; they solve one specific problem: brightness rules damaging the subject interior.

| Preset | Use it when |
| --- | --- |
| Soft | The subject is mostly intact, with small transparent patches |
| Balanced | The default first try for most buildings, characters, and props |
| Strong | Large interior areas are transparent, or building structure, armor, and dark texture are being removed |

Recommended flow:

1. Preview with `BiRefNet + Luma`.
2. If glow is preserved but the subject becomes transparent, click `Balanced`.
3. Preview again; if it is still transparent, click `Strong`.
4. If the subject is protected but the background becomes dirty, slightly raise Luma black point or lower Luma strength.

### How To Use CorridorKey

CorridorKey is screen refinement, not a general-purpose matting mode. Use it for green/blue screen footage when the edge alpha is mostly correct but the edge color is polluted by screen spill.

Before using it, confirm:

- The source is truly green-screen or blue-screen.
- Solid-color keying or BiRefNet already gives a mostly correct alpha.
- The main problem is dirty edge color, not failed subject detection.

Steps:

1. First create a mostly correct preview with `Solid color / green screen` or `BiRefNet`.
2. Enable `CorridorKey refinement`.
3. Leave Screen type on `Auto`; choose `Green` or `Blue` manually only if auto picks wrong.
4. Keep despill strength around `0.8` to `1.5`.
5. Click `Preview current frame` and zoom into the edge.
6. If the edge is cleaner, process the full range.

Do not use CorridorKey when:

- The background is not green/blue screen.
- The asset is mostly fire, lightning, particles, or glow.
- You are already using `BiRefNet + Luma` to preserve VFX.
- The problem is wrong subject recognition rather than screen-edge contamination.

CorridorKey troubleshooting:

| Symptom | What to change |
| --- | --- |
| Green/blue edge remains | Choose screen type manually, raise despill, optionally add Halo `1` |
| Edge is eaten away | Lower threshold or Halo so the base alpha is more complete |
| Processing is slow | Lower target height or AI edge resolution; confirm with preview first |
| Result is worse than without it | Turn CorridorKey off and use normal despill plus post-processing |

### Recommended Full Workflow

For a batch of assets, do not jump straight to `Start processing`. A steadier workflow is:

1. Import the source and trim the useful range.
2. Stop on the most difficult frame.
3. Choose a matting mode based on the source type.
4. Click `Preview current frame`.
5. Zoom in and inspect edges, subject interiors, and glow areas.
6. Tune BiRefNet / Luma / CorridorKey based on the actual problem.
7. Test `Green residue to black` or `Semi-transparent to black` only if the edge needs it.
8. Decide whether to enable the matching batch post-processing options.
9. Click `Start processing`.
10. In Step 4, preview the animation for continuity, then export.

## Single-Frame Preview And Preview Post-Processing

`Preview current frame` processes only the current frame so you can tune settings quickly. The preview area shows source and processed images, with zoom controls for edge inspection.

After previewing, you can:

- `Green residue to black`: turns remaining green pixels black while preserving alpha.
- `Semi-transparent to black`: turns semi-transparent pixels' RGB values black while preserving alpha.
- `Download preview image`: downloads the current processed PNG.

These buttons affect only the current preview image. To apply the same cleanup to a full processed range, enable the matching options under batch post-processing.

## Batch Post-Processing

Batch post-processing is applied to every processed output frame when you click `Start processing`.

Options:

- `Green residue to black`: useful when edge pixels still contain green and the target engine/background makes that visible.
- `Semi-transparent to black`: useful when translucent RGB values create white or colored halos in a game engine.

Notes:

- These options change RGB values but preserve alpha.
- Test with a single preview first, especially if the asset will appear on light backgrounds.
- Be careful with `Semi-transparent to black` on colorful glow effects, because it can reduce colored halos.

## Step 4: Review Frames And Export

After processing, the result panel lets you inspect frames, choose which ones to keep, preview animation, and export.

### Frame Selection

Available controls:

- `Select all`
- `Select none`
- `Odd frames`
- `Even frames`
- `Invert selection`

You can also manually check or uncheck individual frames.

Common uses:

- Animation is too slow: keep only odd or even frames.
- Empty frames at the start/end: uncheck them manually.
- Loop has a pause: remove the first or last duplicate-looking frame.

### Animation Preview

The preview loops through the selected frames.

You can adjust:

- Preview background color, to inspect white/black/colored edge halos.
- Frame interval, to approximate the in-game playback speed.
- Reverse playback/export, to play and export frames in reverse order.

`Reverse playback/export` affects the final export order.

### Export

Set the sprite sheet column count, then click `Export selected frames`.

Exported outputs include:

- `frames/`: transparent PNG frame sequence.
- `sprite_sheet.png`: packed sprite sheet.
- `frames.zip`: zipped frame files.
- `export.json`: manifest with frame order, dimensions, and sheet metadata.

When reverse export is enabled, the frame sequence, sprite sheet, and manifest all use the reversed selected-frame order.

## Common Settings

### Green-Screen Character Action

- Matting mode: `Solid color / green screen`
- Key color: manual, sampled from the actual screen color
- Threshold: `70` to `100`
- Softness: `20` to `40`
- Despill: `0.8` to `1.5`
- Halo: `1` or `2`
- If the edge is still dirty: enable CorridorKey

### AI-Generated Character Or Building

- Matting mode: `BiRefNet`
- AI model: `BiRefNet HR-matting`
- AI device: `auto`
- AI edge resolution: `1024` to `2048`
- If the interior becomes transparent: use `BiRefNet + Luma` and a subject-protection preset

### Fire, Lightning, Particles

- Matting mode: `BiRefNet + Luma`
- Luma white point: `65` to `120`
- Luma strength: `1.3` to `2.0`
- Halo: `0`
- CorridorKey: off
- Batch post-processing: leave off first unless preview confirms it is needed

### Wide Attack Trail

- Canvas layout: `Auto width centered`
- Padding: `24` to `48`
- Keep every N frames: `1` or `2`
- Check the left and right edges before export

### Existing Transparent PNG

- Background removal: off, or matting mode `No matting`
- Canvas layout: choose by asset type
- Target height: set to your project size
- Process and export directly

## Output Folders

Runtime files are stored under `work/`:

```text
work/
  uploads/    Imported media copies
  previews/   Single-frame preview outputs
  jobs/       Processed frame jobs
  exports/    Export packages, sprite sheets, and manifests
```

`work/` is ignored by git.

## Troubleshooting

### Video Import Fails Or ffmpeg Is Missing

- Make sure `ffmpeg.exe` and `ffprobe.exe` are on `PATH`.
- Or set `SPRITE_VIDEO_LAB_FFMPEG_DIR` to the folder containing them.
- Restart the terminal and relaunch the app.

### AI Matting Is Slow The First Time

The first run may download and load model files. Later runs reuse the local cache.

### CUDA Is Not Available

Set AI device to `cpu`, or leave it on `auto`. CPU works but is much slower.

### Green Or Blue Edge Remains

Try this order:

1. Manually choose the real background color.
2. Increase despill strength.
3. Set Halo to `1` or `2`.
4. Enable CorridorKey for true green/blue screen sources.
5. Use `Green residue to black` if residue is still visible.

### White Edge Appears In The Game Engine

White edges often come from RGB values in semi-transparent pixels. Try `Semi-transparent to black`, but preview it on both light and dark backgrounds first.

### Sprite Sheet Is Too Large

- Lower target height.
- Increase `Keep every N frames`.
- Reduce padding.
- Uncheck unnecessary frames.
- Increasing sheet columns changes layout only; it does not reduce total pixels.

### Animation Direction Is Wrong

Enable `Reverse playback/export` in Step 4, confirm the preview, then export again.

## Practical Habits

- Always tune with single-frame preview before processing a long range.
- Preview the most difficult frame: dirty edges, complex light, or heavy motion.
- Check the result on different preview background colors before export.
- Keep target height, canvas layout, and padding consistent for a batch of related sprites.
- Keep `export.json` with important assets so you can inspect frame order and export metadata later.
