"""
DrumDiffViz: Composite Spectrogram Animator for CFG Analysis (16kHz).
Author: Domain Expert (AI)

Generates a 10-second video with a single composite spectrogram background.
Active sections are highlighted ("bolded") while others are dimmed.
"""

import os
import tempfile
import numpy as np
import librosa
import librosa.display
import matplotlib.pyplot as plt
import soundfile as sf
from moviepy import (
    AudioFileClip, ImageClip, CompositeVideoClip, 
    TextClip, concatenate_videoclips
)
from io import BytesIO
from PIL import Image

def mplfig_to_npimage(fig, target_size=None):
    """Convert matplotlib figure to numpy array with exact target size."""
    buf = BytesIO()
    fig.savefig(buf, format='png', dpi=fig.dpi, bbox_inches='tight', pad_inches=0)
    buf.seek(0)
    img = Image.open(buf)
    if target_size:
        img = img.resize(target_size, Image.LANCZOS)
    return np.array(img.convert('RGB'))

# ==========================================
# 1. Configuration & Constants
# ==========================================

class VizConfig:
    SR = 16000
    CLIP_DURATION = 2.5     
    TOTAL_DURATION = 10.0
    NUM_CLIPS = 4
    
    # STFT Params
    N_FFT = 1024            
    HOP_LENGTH = 256
    
    # Visual Params
    RESOLUTION = (1920, 1080)
    DPI = 100
    FPS = 30
    COLORMAP = 'magma'      
    
    # UI Elements
    CURSOR_COLOR = (255, 255, 255) 
    CURSOR_WIDTH = 4        
    TEXT_FONT = "/System/Library/Fonts/Helvetica.ttc"
    TEXT_SIZE = 60
    TEXT_COLOR = 'white'
    TEXT_BG_COLOR = 'black'
    
    # Dimming factor for inactive sections
    DIM_FACTOR = 0.35

# ==========================================
# 2. Signal Processing Engine
# ==========================================

class AudioEngine:
    @staticmethod
    def load_and_stitch(files, config):
        """
        Loads audio files and extracts consecutive time slices from each.
        """
        stitched_audio = []
        samples_per_clip = int(config.SR * config.CLIP_DURATION)
        
        for i, f in enumerate(files):
            try:
                y, _ = librosa.load(f['path'], sr=config.SR)
                start_sample = int(i * config.CLIP_DURATION * config.SR)
                end_sample = start_sample + samples_per_clip
                
                if end_sample <= len(y):
                    y_slice = y[start_sample:end_sample]
                else:
                    available = y[start_sample:] if start_sample < len(y) else np.array([])
                    y_slice = np.pad(available, (0, samples_per_clip - len(available)))
                
                stitched_audio.append(y_slice)
                print(f"  {f['label']}: {i * config.CLIP_DURATION:.1f}s - {(i+1) * config.CLIP_DURATION:.1f}s")
            except Exception as e:
                print(f"Error loading {f['path']}: {e}")
                stitched_audio.append(np.zeros(samples_per_clip))
                
        y_full = np.concatenate(stitched_audio)
        return y_full, stitched_audio

# ==========================================
# 3. Visualization Renderer
# ==========================================

class FrameRenderer:
    def __init__(self, config):
        self.config = config

    def render_composite_spectrogram(self, y_full):
        """
        Renders the full 10s STFT spectrogram to exact resolution.
        """
        w, h = self.config.RESOLUTION
        w_in = w / self.config.DPI
        h_in = h / self.config.DPI
        
        # Compute STFT
        D = librosa.stft(y_full, n_fft=self.config.N_FFT, hop_length=self.config.HOP_LENGTH)
        S_db = librosa.amplitude_to_db(np.abs(D), ref=np.max)
        
        fig = plt.figure(figsize=(w_in, h_in), dpi=self.config.DPI)
        ax = fig.add_axes([0, 0, 1, 1])
        
        librosa.display.specshow(
            S_db, 
            sr=self.config.SR, 
            hop_length=self.config.HOP_LENGTH, 
            x_axis='time', 
            y_axis='log', 
            cmap=self.config.COLORMAP,
            ax=ax
        )
        
        ax.axis('off')
        
        image_np = mplfig_to_npimage(fig, target_size=(w, h))
        plt.close(fig)
        
        return image_np
    
    def create_state_image(self, base_img, active_section, num_sections):
        """
        Creates an image where the active section is bright, others are dimmed.
        """
        h, w, c = base_img.shape
        section_w = w // num_sections
        
        # Start with dimmed version
        state_img = (base_img * self.config.DIM_FACTOR).astype(np.uint8)
        
        # Highlight active section
        start_x = active_section * section_w
        end_x = (active_section + 1) * section_w if active_section < num_sections - 1 else w
        
        state_img[:, start_x:end_x] = base_img[:, start_x:end_x]
        
        return state_img

# ==========================================
# 4. Animation Orchestrator
# ==========================================

class AnimationOrchestrator:
    def __init__(self, config):
        self.config = config
        self.audio_engine = AudioEngine()
        self.renderer = FrameRenderer(config)

    def create_composite_video(self, files):
        # 1. Load and stitch audio
        print("Loading audio clips...")
        y_full, audio_clips = self.audio_engine.load_and_stitch(files, self.config)
        
        # 2. Render full spectrogram
        print("Rendering composite spectrogram...")
        base_img = self.renderer.render_composite_spectrogram(y_full)
        
        # 3. Create state-based clips
        print("Creating video clips...")
        clips = []
        w, h = self.config.RESOLUTION
        
        for i, file_info in enumerate(files):
            # Create image with active section highlighted
            state_img = self.renderer.create_state_image(base_img, i, self.config.NUM_CLIPS)
            
            # Create video clip
            base_clip = ImageClip(state_img).with_duration(self.config.CLIP_DURATION)
            
            # Add label
            txt = TextClip(
                text=file_info['label'], 
                font=self.config.TEXT_FONT, 
                font_size=self.config.TEXT_SIZE, 
                color=self.config.TEXT_COLOR, 
                bg_color=self.config.TEXT_BG_COLOR
            )
            txt = txt.with_position(('center', 50)).with_duration(self.config.CLIP_DURATION)
            
            comp_clip = CompositeVideoClip([base_clip, txt], size=(w, h))
            clips.append(comp_clip)
            
        # 4. Concatenate
        final_video = concatenate_videoclips(clips)
        
        # 5. Add audio
        temp_wav = os.path.join(tempfile.gettempdir(), "temp_stitched.wav")
        sf.write(temp_wav, y_full, self.config.SR)
        audio_track = AudioFileClip(temp_wav)
        final_video = final_video.with_audio(audio_track)
        
        # 6. Add cursor
        print("Adding cursor overlay...")
        
        def cursor_pos(t):
            x = int(t * (w / self.config.TOTAL_DURATION))
            return (x, 0)
            
        cursor_surface = np.zeros((h, self.config.CURSOR_WIDTH, 4), dtype=np.uint8)
        cursor_surface[:, :, :3] = self.config.CURSOR_COLOR
        cursor_surface[:, :, 3] = 200
        
        cursor_clip = ImageClip(cursor_surface, is_mask=False).with_duration(self.config.TOTAL_DURATION)
        cursor_clip = cursor_clip.with_position(cursor_pos)
        
        final_output = CompositeVideoClip([final_video, cursor_clip], size=(w, h))
        return final_output

# ==========================================
# 5. Execution Logic
# ==========================================

def run_pipeline():
    cfg_folder = "static/audio/midi_conditioned/cfg"
    baseline_folder = "static/audio/baseline/version_83/enhancement/use_midi=False_epoch_50"
    audio_filename = "drummer1_1_funk-groove1_138_beat_4-4_bluebird.wav"
    
    file_list = [
        {'path': f"{baseline_folder}/{audio_filename}", 'label': 'Baseline (w=0)'},
        {'path': f"{cfg_folder}/w_1.0/{audio_filename}", 'label': 'CFG w=1.0'},
        {'path': f"{cfg_folder}/w_2.0/{audio_filename}", 'label': 'CFG w=2.0'},
        {'path': f"{cfg_folder}/w_3.0/{audio_filename}", 'label': 'CFG w=3.0'},
    ]
    
    config = VizConfig()
    orchestrator = AnimationOrchestrator(config)
    
    video = orchestrator.create_composite_video(file_list)
    
    print("Writing video file...")
    video.write_videofile(
        "cfg_composite_analysis_16k.mp4", 
        fps=config.FPS, 
        codec='libx264', 
        audio_codec='aac',
        bitrate='8000k'
    )

if __name__ == "__main__":
    run_pipeline()
