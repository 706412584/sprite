# AI Matting Runtime

Sprite Video Lab can optionally use BiRefNet and CorridorKey for AI background removal:

- `BiRefNet`: subject alpha from the model.
- `Luma`: brightness-derived alpha for glow, fire, lightning, particles, and bright-on-dark VFX.
- `BiRefNet + Luma`: subject alpha plus brightness alpha for glow, fire, lightning, particles, and other VFX.
- `CorridorKey`: uses the green-screen key alpha as a coarse hint, then reconstructs foreground color and a refined alpha for green or blue screen plates.
- `BiRefNet + CorridorKey`: uses the BiRefNet alpha as the coarse hint for CorridorKey.
- `BiRefNet + Luma + CorridorKey`: combines subject alpha and brightness alpha first, then uses that combined alpha as the CorridorKey hint.

The app keeps the chroma-key workflow. AI matting is only used when you select it in step 3.

## Model Cache

AI models are downloaded by the local runtime when selected for the first time. The cache location is controlled by:

```bat
set SPRITE_VIDEO_LAB_AI_MODEL_CACHE=<model-cache-dir>
```

If you do not set it, the app chooses a local default. On Windows, the helper scripts prefer keeping the optional AI runtime and model cache outside the project checkout when possible.

CorridorKey is kept separately from the app checkout. Its location is controlled by:

```bat
set SPRITE_VIDEO_LAB_CORRIDORKEY_ROOT=<corridorkey-dir>
```

The Windows helper uses the same optional AI root as the BiRefNet runtime and stores CorridorKey checkpoints under `CorridorKeyModule\checkpoints`.

You can also override the Python runtime used by the launcher:

```bat
set SPRITE_VIDEO_LAB_PYTHON=<python-runtime>
```

## Setup

Run:

```bat
setup_ai_runtime.bat
```

The script installs the base app dependencies, optional AI dependencies, a CUDA-enabled PyTorch wheel for Windows, and clones CorridorKey when git is available. If CUDA is not available on your machine, the app can still run in compatibility mode, but AI matting will be slower.

Then start the app as usual:

```bat
start_sprite_video_lab.bat
```

## Tuning

- `BiRefNet HR-matting` is the quality-first default.
- `BiRefNet lite-2K` is the lighter fallback when memory or speed is tight.
- If a green edge remains, raise `despill strength` first. Try `1.2` to `1.8`.
- If the edge is still dirty, set `halo shrink` to `1` or `2`.
- For green-screen sources, use manual background color and pick the actual background green when auto corner sampling misses the key color.
- Use `BiRefNet + Luma` for VFX-heavy material. Use plain `BiRefNet` when there is no glow or bright particle effect to preserve.
- Enable `CorridorKey refinement` when the alpha is acceptable but the foreground edge still contains green/blue contamination. It is most useful for true green/blue screen footage.
- Leave CorridorKey screen type on `Auto` unless the sampled background color is misleading; force `Green` or `Blue` when needed.

## Security Note

BiRefNet models are loaded through Hugging Face with `trust_remote_code=True`. For production or stricter environments, review the model repository and pin a known revision before deployment.

CorridorKey is licensed separately from this app and has non-commercial/share-alike restrictions for redistribution and paid inference services. Review its upstream license before shipping it as part of a commercial product.
