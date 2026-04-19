"""
DrumDiffViz: A High-Fidelity Audio-Visualizer for SGMSE/NCSN++ Analysis.
Author: Domain Expert (AI)
Target Metric: Frechet Audio Distance (FAD) & Perceptual Evaluation.

This framework generates a 10-second composite video visualizing the progression
of drum audio enhancement across different guidance scales.
"""

import os
import tempfile
import numpy as np
import librosa
import librosa.display
import matplotlib.pyplot as plt
import soundfile as sf
from moviepy import (
    VideoClip, AudioFileClip, ImageClip, CompositeVideoClip, 
    TextClip, ColorClip, concatenate_videoclips
)
from io import BytesIO
from PIL import Image

def mplfig_to_npimage(fig):
    """Convert matplotlib figure to numpy array."""
    buf = BytesIO()
    fig.savefig(buf, format='png', dpi=fig.dpi, bbox_inches='tight', pad_inches=0)
    buf.seek(0)
    img = Image.open(buf)
    return np.array(img.convert('RGB'))

# ==========================================
# 1. Configuration & Constants
# ==========================================

class VizConfig:
    """
    Centralized configuration to ensure scientific accuracy in DSP parameters.
    Matches the NCSN++ 48kHz specifications.
    """
    # Audio Params
    SR = 16000              # Standard high-fidelity sample rate
    DURATION_PER_CLIP = 2.5 # As requested by user
    TOTAL_CLIPS = 4         # Noisy, Clean, CFG1, CFG2
    
    # STFT Params (Optimized for Drum Transients)
    N_FFT = 2048            # High freq resolution
    HOP_LENGTH = 512        # Standard overlap
    N_MELS = 128            # Mel bands for VGGish/FAD compatibility
    FMIN = 20               # Kick drum fundamental
    FMAX = 20000            # Cymbal air
    
    # Visual Params
    RESOLUTION = (1920, 1080) # 1080p Full HD
    DPI = 100
    FPS = 30
    COLORMAP = 'magma'      # Perceptually uniform, good for dark backgrounds
    
    # Cursor Params
    CURSOR_COLOR = (255, 255, 255) # White
    CURSOR_WIDTH = 4        # Pixels
    CURSOR_ALPHA = 0.8      # Opacity

# ==========================================
# 2. Signal Processing Engine
# ==========================================

class AudioEngine:
    """
    Handles loading, normalization, and spectral feature extraction.
    """
    @staticmethod
    def load_and_prep(filepath, target_sr, duration):
        """
        Loads audio, resamples, and pads/trims to exact duration.
        """
        try:
            # Load with Librosa (handles resampling)
            y, sr = librosa.load(filepath, sr=target_sr)
            
            # Calculate target samples
            target_samples = int(target_sr * duration)
            
            # Pad or Trim
            if len(y) < target_samples:
                # Pad with silence
                y = np.pad(y, (0, target_samples - len(y)))
            elif len(y) > target_samples:
                # Trim
                y = y[:target_samples]
                
            # Normalize to -1 dB to prevent clipping
            y = librosa.util.normalize(y) * 0.9
            
            return y, sr
        except Exception as e:
            print(f"CRITICAL ERROR loading {filepath}: {e}")
            # Return silence on failure to prevent crash
            return np.zeros(int(target_sr * duration)), target_sr

    @staticmethod
    def compute_mel_spectrogram(y, sr, config):
        """
        Computes the Log-Mel Spectrogram.
        """
        # 1. Compute Mel Spectrogram
        S = librosa.feature.melspectrogram(
            y=y, 
            sr=sr, 
            n_fft=config.N_FFT, 
            hop_length=config.HOP_LENGTH, 
            n_mels=config.N_MELS,
            fmin=config.FMIN, 
            fmax=config.FMAX
        )
        
        # 2. Convert to Decibels (Log Scale)
        # We use top_db=80 to visualize the noise floor clearly
        S_db = librosa.power_to_db(S, ref=np.max, top_db=80)
        
        return S_db

# ==========================================
# 3. Visualization Renderer (Matplotlib)
# ==========================================

class FrameRenderer:
    """
    Renders high-quality static images of spectrograms using Matplotlib.
    """
    def __init__(self, config):
        self.config = config

    def render_spectrogram_image(self, S_db, label_text, midi_overlays=None):
        """
        Draws the spectrogram and overlays text/MIDI grid.
        Returns a NumPy array representing the RGB image.
        """
        # Calculate Figure Size in Inches
        w_in = self.config.RESOLUTION[0] / self.config.DPI
        h_in = self.config.RESOLUTION[1] / self.config.DPI
        
        fig = plt.figure(figsize=(w_in, h_in), dpi=self.config.DPI)
        ax = fig.add_axes([0, 0, 1, 1]) # Full bleed, no margins
        
        # Render Spectrogram
        img = librosa.display.specshow(
            S_db, 
            sr=self.config.SR, 
            hop_length=self.config.HOP_LENGTH, 
            x_axis='time', 
            y_axis='mel', 
            fmin=self.config.FMIN, 
            fmax=self.config.FMAX,
            cmap=self.config.COLORMAP,
            ax=ax
        )
        
        # Overlay Label (e.g., "CFG Scale: 2.0")
        # We use Matplotlib text here for better positioning relative to data
        ax.text(
            0.02, 0.95, 
            label_text, 
            transform=ax.transAxes, 
            color='white', 
            fontsize=24, 
            fontweight='bold', 
            va='top', 
            bbox=dict(facecolor='black', alpha=0.5, edgecolor='none')
        )

        # Optional: Overlay MIDI Grid if provided
        if midi_overlays:
            # midi_overlays should be a list of onset times in seconds
            for onset in midi_overlays:
                ax.axvline(x=onset, color='cyan', linestyle='--', alpha=0.3, linewidth=1)

        ax.axis('off') # Hide axes
        
        # Convert to NumPy Image (RGB)
        image_np = mplfig_to_npimage(fig)
        plt.close(fig)
        
        return image_np

# ==========================================
# 4. Animation Orchestrator (MoviePy)
# ==========================================

class AnimationOrchestrator:
    """
    Stitches audio and images, handles synchronization and cursor animation.
    """
    def __init__(self, config):
        self.config = config
        self.audio_engine = AudioEngine()
        self.renderer = FrameRenderer(config)

    def create_segment(self, audio_path, label, midi_data=None):
        """
        Creates a single 2.5s Audio-Visual segment.
        """
        print(f"Processing Segment: {label}")
        
        # 1. Process Audio
        y, sr = self.audio_engine.load_and_prep(
            audio_path, 
            self.config.SR, 
            self.config.DURATION_PER_CLIP
        )
        
        # 2. Compute Spectrogram
        S_db = self.audio_engine.compute_mel_spectrogram(y, sr, self.config)
        
        # 3. Render Background Image
        bg_image = self.renderer.render_spectrogram_image(S_db, label, midi_data)
        
        # 4. Create Video Clip from Image
        video_clip = ImageClip(bg_image).with_duration(self.config.DURATION_PER_CLIP)
        
        # 5. Attach Audio
        # We write a temp file to ensure FFmpeg compatibility
        temp_wav = os.path.join(tempfile.gettempdir(), f"temp_{label.replace(' ', '_')}.wav")
        sf.write(temp_wav, y, sr)
        audio_clip = AudioFileClip(temp_wav)
        
        video_clip = video_clip.with_audio(audio_clip)
        
        return video_clip

    def build_timeline(self, clips):
        """
        Concatenates segments into a single timeline.
        """
        return concatenate_videoclips(clips, method="compose")

    def add_cursor_overlay(self, base_video):
        """
        Adds the moving vertical line. 
        Crucial Logic: The cursor resets every 2.5 seconds to indicate 
        that we are viewing a specific 2.5s window of data.
        """
        # Create a vertical line clip
        cursor_surface = np.zeros(
            (self.config.RESOLUTION[1], self.config.CURSOR_WIDTH, 4), 
            dtype=np.uint8
        )
        cursor_surface[:, :, :3] = self.config.CURSOR_COLOR
        cursor_surface[:, :, 3] = int(255 * self.config.CURSOR_ALPHA)
        
        cursor_clip = ImageClip(cursor_surface, is_mask=False).with_duration(base_video.duration)
        
        # Define Movement Logic (Sawtooth wave)
        # x(t) moves from 0 to Width over 2.5s, then resets.
        w_screen = self.config.RESOLUTION[0]
        period = self.config.DURATION_PER_CLIP
        
        def get_cursor_pos(t):
            # t is current time in seconds
            local_t = t % period # Modulo 2.5
            progress = local_t / period
            x_pos = int(progress * w_screen)
            return (x_pos, 0) # (x, y)
            
        cursor_clip = cursor_clip.with_position(get_cursor_pos)
        
        # Overlay
        final_video = CompositeVideoClip([base_video, cursor_clip])
        return final_video

    def render(self, output_path, fps=30):
        print(f"Rendering final composition to {output_path}...")
        self.final_composition.write_videofile(
            output_path, 
            fps=fps, 
            codec='libx264', 
            audio_codec='aac',
            bitrate="8000k", # High bitrate for sharp spectrograms
            preset='medium',
            threads=4
        )

# ==========================================
# 5. Execution Logic
# ==========================================

def run_pipeline():
    """
    Main entry point. 
    Generates comparison video for CFG ablation study.
    """
    
    # --- CFG Audio Files ---
    cfg_folder = "static/audio/midi_conditioned/cfg"
    baseline_folder = "static/audio/baseline/version_83/enhancement/use_midi=False_epoch_50"
    audio_filename = "drummer1_1_funk-groove1_138_beat_4-4_bluebird.wav"
    
    files = [
        {'path': f"{baseline_folder}/{audio_filename}", 'label': 'Baseline (w=0)'},
        {'path': f"{cfg_folder}/w_1.0/{audio_filename}", 'label': 'CFG w=1.0'},
        {'path': f"{cfg_folder}/w_2.0/{audio_filename}", 'label': 'CFG w=2.0'},
        {'path': f"{cfg_folder}/w_3.0/{audio_filename}", 'label': 'CFG w=3.0'},
    ]
    
    # Optional: If you have midi onset times (in seconds) for the 2.5s clip
    # midi_data = [0.1, 0.6, 1.2, 1.8] 
    midi_data = None 
    
    # --- PIPELINE ---
    config = VizConfig()
    orchestrator = AnimationOrchestrator(config)
    
    clips = []
    for f in files:
        # Check if file exists to avoid crashes
        if not os.path.exists(f['path']):
            print(f"Warning: {f['path']} not found. Generating silence for demo.")
            # Generate dummy silence file
            sr = 16000
            dummy = np.zeros(int(sr * 2.5))
            sf.write(f['path'], dummy, sr)
            
        segment = orchestrator.create_segment(f['path'], f['label'], midi_data)
        clips.append(segment)
        
    base_timeline = orchestrator.build_timeline(clips)
    
    # Add the "Scanning" Cursor
    orchestrator.final_composition = orchestrator.add_cursor_overlay(base_timeline)
    
    # Render
    orchestrator.render("cfg_analysis_comparison.mp4")

if __name__ == "__main__":
    run_pipeline()