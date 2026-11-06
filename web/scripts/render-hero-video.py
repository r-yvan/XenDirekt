#!/usr/bin/env python3
"""Renders the website's hero background video.

Rwanda's "thousand hills", in monochrome: rolling ridgelines receding into haze, mist drifting
through the valleys and cloud shadows sliding over the slopes. Two grades are rendered:
  dark   dusk greys and blacks, pale moonlit mist
  light  morning whites and light greys, white mist

The hills are static; only light and mist move. Mist and shadows use a two-phase flow (two
independent noise fields that cross-fade while they drift, with a variance-preserving blend), so
the 20-second loop has no seam and no visible pulse.

Usage (from /web):
  python3 scripts/render-hero-video.py --preview   # a few PNG stills into qa-output/
  python3 scripts/render-hero-video.py             # full render into public/media/

Needs numpy, opencv-python and ffmpeg (libx264 + libsvtav1).
"""

from __future__ import annotations

import argparse
import multiprocessing
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

W, H = 1920, 1080
FPS = 30
SECONDS = 20
FRAMES = FPS * SECONDS
FOG_SCALE = 2  # mist is computed at half resolution, then upsampled
ROOT = Path(__file__).resolve().parent.parent


# ----------------------------------------------------------------------------------------------
# Noise
# ----------------------------------------------------------------------------------------------


def spectral_noise_2d(
    h: int, w: int, beta: float, seed: int, stretch: tuple[float, float] = (1.0, 1.0)
) -> np.ndarray:
    """Tileable fractal noise in [0, 1] (1/f^beta spectrum).

    stretch=(sx, sy) scales the frequencies: sx > sy damps fast horizontal variation, so
    features come out elongated horizontally (wisps, terraces).
    """
    rng = np.random.default_rng(seed)
    white = rng.standard_normal((h, w))
    fy = np.fft.fftfreq(h)[:, None] * stretch[1]
    fx = np.fft.fftfreq(w)[None, :] * stretch[0]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1.0
    spectrum = np.fft.fft2(white) / np.power(f, beta / 2.0 + 0.5)
    spectrum[0, 0] = 0.0
    field = np.real(np.fft.ifft2(spectrum))
    lo, hi = np.percentile(field, [0.5, 99.5])
    return np.clip((field - lo) / (hi - lo), 0.0, 1.0).astype(np.float32)


def spectral_noise_1d(n: int, beta: float, seed: int) -> np.ndarray:
    """Zero-mean 1-D fractal noise with unit standard deviation."""
    rng = np.random.default_rng(seed)
    white = rng.standard_normal(n)
    f = np.abs(np.fft.fftfreq(n))
    f[0] = 1.0
    spectrum = np.fft.fft(white) / np.power(f, beta / 2.0 + 0.5)
    spectrum[0] = 0.0
    line = np.real(np.fft.ifft(spectrum))
    return ((line - line.mean()) / line.std()).astype(np.float32)


def shift_wrap(field: np.ndarray, dx: float, dy: float = 0.0) -> np.ndarray:
    """Sub-pixel translation with wrap-around (the noise fields are tileable)."""
    matrix = np.float32([[1, 0, dx], [0, 1, dy]])
    return cv2.warpAffine(
        field,
        matrix,
        (field.shape[1], field.shape[0]),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_WRAP,
    )


def two_phase_flow(
    a: np.ndarray, b: np.ndarray, t: float, speed: tuple[float, float], period: float
) -> np.ndarray:
    """Drifting noise that loops every `period` seconds without a seam.

    Field a drifts while its weight rises and falls; field b does the same half a cycle later.
    Each field jumps back only while its weight is zero. The blend keeps the variance constant so
    the mist never visibly flattens mid-cycle.
    """
    phase = (t / period) % 1.0
    phase_b = (phase + 0.5) % 1.0
    weight_a = 1.0 - abs(2.0 * phase - 1.0)
    weight_b = 1.0 - weight_a
    fa = shift_wrap(a, speed[0] * phase * period, speed[1] * phase * period)
    fb = shift_wrap(b, speed[0] * phase_b * period, speed[1] * phase_b * period)
    norm = np.sqrt(weight_a * weight_a + weight_b * weight_b)
    blended = (weight_a * (fa - 0.5) + weight_b * (fb - 0.5)) / norm + 0.5
    return np.clip(blended, 0.0, 1.0)


# ----------------------------------------------------------------------------------------------
# Scene
# ----------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Grade:
    name: str
    sky_top: float
    sky_horizon: float
    layers: tuple[float, ...]  # hill luminance, far → near
    mist: float  # mist luminance
    mist_strength: float
    shadow_strength: float  # how much a cloud shadow darkens a slope
    rim: float  # brightening along each ridge (sky light catching the crest)
    texture: float  # vegetation texture amplitude


DARK = Grade(
    name="dark",
    sky_top=0.018,
    sky_horizon=0.105,
    layers=(0.148, 0.120, 0.094, 0.072, 0.053, 0.038, 0.027),
    mist=0.34,
    mist_strength=0.55,
    shadow_strength=0.16,
    rim=0.028,
    texture=0.010,
)

LIGHT = Grade(
    name="light",
    sky_top=0.995,
    sky_horizon=0.948,
    layers=(0.905, 0.872, 0.840, 0.808, 0.776, 0.746, 0.716),
    mist=0.992,
    mist_strength=0.62,
    shadow_strength=0.075,
    rim=0.012,
    texture=0.012,
)

# Ridge geometry, far → near (fractions of the frame height; softness in pixels).
BASELINES = (0.475, 0.525, 0.578, 0.632, 0.690, 0.756, 0.830)
AMPLITUDES = (0.042, 0.052, 0.062, 0.074, 0.086, 0.098, 0.112)
SOFTNESS = (3.2, 2.6, 2.1, 1.7, 1.4, 1.2, 1.0)
TREES = (0.5, 0.7, 0.9, 1.2, 1.6, 2.1, 2.8)  # tree-line roughness on each ridge, pixels
MIST_SPEED = (14.0, 18.0, 23.0, 29.0, 36.0, 44.0, 54.0)  # px/s, parallax: near mist moves faster
MIST_THICKNESS = (0.040, 0.046, 0.052, 0.060, 0.068, 0.078, 0.090)


class Landscape:
    def __init__(self) -> None:
        xs = np.arange(W, dtype=np.float32)
        self.ridges: list[np.ndarray] = []
        for index, (base, amp, trees) in enumerate(zip(BASELINES, AMPLITUDES, TREES)):
            # Many rounded summits: a rolling base plus a finer layer of hilltops.
            rolling = spectral_noise_1d(W * 2, beta=2.3, seed=100 + index)[:W]
            summits = spectral_noise_1d(W * 2, beta=2.2, seed=200 + index)[:W]
            hills = 0.82 * rolling + 0.30 * summits
            canopy = spectral_noise_1d(W, beta=0.9, seed=300 + index) * trees
            ridge = base * H - amp * H * hills + canopy
            # Keep the far ridges low enough to leave a calm sky behind the headline.
            self.ridges.append(np.maximum(ridge, 0.40 * H).astype(np.float32))
        self.ys = np.arange(H, dtype=np.float32)[:, None]
        self.xs = xs
        # Coverage masks with anti-aliased edges.
        self.masks = [
            np.clip((self.ys - ridge[None, :]) / soft + 0.5, 0.0, 1.0)
            for ridge, soft in zip(self.ridges, SOFTNESS)
        ]
        # Fine vegetation / field texture inside the hills.
        self.texture = spectral_noise_2d(H, W, beta=1.5, seed=7, stretch=(2.6, 0.8)) - 0.5
        # Mist fields (half resolution), two independent fields per depth for the flow.
        fh, fw = H // FOG_SCALE, W // FOG_SCALE
        self.mist_fields = [
            (
                spectral_noise_2d(fh, fw, beta=2.4, seed=400 + 2 * i, stretch=(3.2, 1.0)),
                spectral_noise_2d(fh, fw, beta=2.4, seed=401 + 2 * i, stretch=(3.2, 1.0)),
            )
            for i in range(len(BASELINES))
        ]
        self.wisp_fields = (
            spectral_noise_2d(fh, fw, beta=2.0, seed=500, stretch=(4.5, 1.0)),
            spectral_noise_2d(fh, fw, beta=2.0, seed=501, stretch=(4.5, 1.0)),
        )
        # Cloud shadows: very large, soft shapes (quarter resolution).
        ch, cw = H // 4, W // 4
        self.cloud_fields = (
            spectral_noise_2d(ch, cw, beta=3.2, seed=600, stretch=(1.6, 1.0)),
            spectral_noise_2d(ch, cw, beta=3.2, seed=601, stretch=(1.6, 1.0)),
        )
        # Mist profiles: densest on the ridge line of the nearer layer, fading upwards.
        self.mist_profiles = []
        for ridge, thickness in zip(self.ridges, MIST_THICKNESS):
            distance = (ridge[None, :] - self.ys) / (thickness * H)
            profile = np.where(distance >= 0, np.exp(-distance * 1.6), np.exp(distance * 6.0))
            self.mist_profiles.append(profile.astype(np.float32))
        # Rim light fades over the first ~22 px below each ridge (static).
        self.rims = [
            1.0 - np.clip((self.ys - ridge[None, :]) / 22.0, 0.0, 1.0) for ridge in self.ridges
        ]
        # A fixed dither (±0.5 of an 8-bit step) hides banding in the smooth gradients.
        self.dither = np.random.default_rng(9).uniform(-0.5, 0.5, (H, W)).astype(np.float32)

    def sky(self, grade: Grade) -> np.ndarray:
        horizon = BASELINES[0] * H
        t = np.clip(self.ys / horizon, 0.0, 1.0) ** 1.6
        sky = grade.sky_top + (grade.sky_horizon - grade.sky_top) * t
        return np.broadcast_to(sky, (H, W)).astype(np.float32).copy()

    def frame(self, grade: Grade, t: float) -> np.ndarray:
        image = self.sky(grade)
        shadow = two_phase_flow(*self.cloud_fields, t, speed=(9.0, 1.2), period=SECONDS)
        shadow = cv2.resize(shadow, (W, H), interpolation=cv2.INTER_CUBIC)
        # Soft-threshold the clouds so only some slopes are in shade at any moment.
        shade = np.clip((shadow - 0.48) / 0.30, 0.0, 1.0)
        shade = shade * shade * (3 - 2 * shade)
        wisps = two_phase_flow(*self.wisp_fields, t, speed=(31.0, -1.5), period=SECONDS)
        for index, (mask, tone) in enumerate(zip(self.masks, grade.layers)):
            # Mist pooled in the valley in front of the previous ridge.
            fa, fb = self.mist_fields[index]
            fog = two_phase_flow(fa, fb, t, speed=(MIST_SPEED[index], 0.0), period=SECONDS)
            fog = 0.62 * fog + 0.38 * wisps
            fog = cv2.resize(fog, (W, H), interpolation=cv2.INTER_LINEAR)
            density = np.clip((fog - 0.30) / 0.55, 0.0, 1.0)
            # The first band sits on the horizon: a thin haze, not a slab of fog.
            depth_haze = 0.45 if index == 0 else 1.0 - 0.06 * index
            alpha = grade.mist_strength * depth_haze * self.mist_profiles[index] * density
            image = image + (grade.mist - image) * alpha
            # The hill layer itself: tone, vegetation texture, rim light, cloud shadow.
            nearness = (index + 1) / len(self.masks)
            layer = tone + grade.texture * nearness * self.texture + grade.rim * self.rims[index]
            layer = layer * (1.0 - grade.shadow_strength * (0.4 + 0.6 * nearness) * shade)
            image = image * (1.0 - mask) + layer * mask
        # A last, low veil of mist over the nearest slopes.
        veil = two_phase_flow(*self.mist_fields[-1], t + 7.0, speed=(62.0, 0.0), period=SECONDS)
        veil = cv2.resize(veil, (W, H), interpolation=cv2.INTER_LINEAR)
        low = np.clip((self.ys / H - 0.80) / 0.20, 0.0, 1.0)
        image = image + (grade.mist - image) * (0.30 * grade.mist_strength * low * veil)
        return image

    def to_bytes(self, image: np.ndarray) -> np.ndarray:
        return np.clip(image * 255.0 + self.dither + 0.5, 0, 255).astype(np.uint8)


# ----------------------------------------------------------------------------------------------
# Output
# ----------------------------------------------------------------------------------------------


def encoders(out_dir: Path, name: str) -> list[subprocess.Popen]:
    common = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-an",
    ]
    h264 = common + [
        "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-profile:v", "high",
        "-pix_fmt", "yuv420p", "-g", str(FPS * 4), "-movflags", "+faststart",
        str(out_dir / f"hero-{name}.mp4"),
    ]
    av1 = common + [
        "-c:v", "libsvtav1", "-preset", "5", "-crf", "34", "-g", str(FPS * 4),
        "-pix_fmt", "yuv420p10le", "-svtav1-params", "tune=0:enable-overlays=1",
        "-movflags", "+faststart",
        str(out_dir / f"hero-{name}.av1.mp4"),
    ]
    return [subprocess.Popen(cmd, stdin=subprocess.PIPE) for cmd in (h264, av1)]


_SCENE: Landscape | None = None
_GRADE: Grade | None = None


def _frame_worker(index: int) -> np.ndarray:
    assert _SCENE is not None and _GRADE is not None
    return _SCENE.to_bytes(_SCENE.frame(_GRADE, index / FPS))


def render(grade: Grade, scene: Landscape, out_dir: Path) -> None:
    global _SCENE, _GRADE
    out_dir.mkdir(parents=True, exist_ok=True)
    _SCENE, _GRADE = scene, grade
    procs = encoders(out_dir, grade.name)
    # Workers are forked after the scene is built, so they share it copy-on-write.
    ctx = multiprocessing.get_context("fork")
    with ctx.Pool(processes=3) as pool:
        frames = pool.imap(_frame_worker, range(FRAMES), chunksize=4)
        for index, frame in enumerate(frames):
            _write(procs, grade, out_dir, index, frame)
    for proc in procs:
        assert proc.stdin is not None
        proc.stdin.close()
        if proc.wait() != 0:
            sys.exit(f"ffmpeg failed for {grade.name}")


def _write(
    procs: list[subprocess.Popen], grade: Grade, out_dir: Path, index: int, frame: np.ndarray
) -> None:
    if index == 0:
        poster = out_dir / f"hero-{grade.name}-poster.webp"
        cv2.imwrite(str(poster), frame, [cv2.IMWRITE_WEBP_QUALITY, 80])
    data = frame.tobytes()
    for proc in procs:
        assert proc.stdin is not None
        proc.stdin.write(data)
    if index % 60 == 0:
        print(f"  {grade.name}: frame {index}/{FRAMES}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", action="store_true", help="write stills only")
    parser.add_argument("--grade", choices=["dark", "light", "both"], default="both")
    args = parser.parse_args()
    scene = Landscape()
    grades = [g for g in (DARK, LIGHT) if args.grade in ("both", g.name)]
    if args.preview:
        out = ROOT / "qa-output"
        out.mkdir(exist_ok=True)
        for grade in grades:
            for second in (0.0, 5.0, 10.0, 19.0):
                frame = scene.to_bytes(scene.frame(grade, second))
                cv2.imwrite(str(out / f"hero-{grade.name}-{int(second):02d}s.png"), frame)
            # Seam check: the frame after the last one must equal the first.
            first = scene.frame(grade, 0.0)
            wrapped = scene.frame(grade, SECONDS)
            print(f"{grade.name}: loop seam max difference {np.abs(first - wrapped).max():.6f}")
        return
    for grade in grades:
        render(grade, scene, ROOT / "public" / "media")


if __name__ == "__main__":
    main()
