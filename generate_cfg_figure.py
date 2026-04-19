"""
Generate a 2x2 spectrogram grid for CFG comparison paper figure.
Top-left: w=0 (Baseline), Top-right: w=1, Bottom-left: w=2, Bottom-right: w=3
"""

import numpy as np
import librosa
import librosa.display
import matplotlib.pyplot as plt
import matplotlib

# Enable LaTeX rendering
matplotlib.rcParams['text.usetex'] = True
matplotlib.rcParams['font.family'] = 'serif'
matplotlib.rcParams['font.serif'] = ['Computer Modern Roman']

# Configuration
SR = 16000
N_FFT = 1024
HOP_LENGTH = 256

# Audio file paths
cfg_folder = "static/audio/midi_conditioned/cfg"
baseline_folder = "static/audio/baseline/version_83/enhancement/use_midi=False_epoch_50"
audio_filename = "drummer1_1_funk-groove1_138_beat_4-4_bluebird.wav"

files = [
    {'path': f"{baseline_folder}/{audio_filename}", 'label': r'$w=0$ (Baseline)', 'w': 0},
    {'path': f"{cfg_folder}/w_1.0/{audio_filename}", 'label': r'$w=1$', 'w': 1},
    {'path': f"{cfg_folder}/w_2.0/{audio_filename}", 'label': r'$w=2$', 'w': 2},
    {'path': f"{cfg_folder}/w_3.0/{audio_filename}", 'label': r'$w=3$', 'w': 3},
]

# Create figure
fig, axes = plt.subplots(2, 2, figsize=(12, 8))
axes = axes.flatten()

# Use same time range for all (e.g., 0-5 seconds for better visibility)
time_range = (0, 2)  # seconds

for idx, f in enumerate(files):
    ax = axes[idx]
    
    # Load audio
    y, sr = librosa.load(f['path'], sr=SR)
    
    # Trim to time range
    start_sample = int(time_range[0] * sr)
    end_sample = int(time_range[1] * sr)
    y = y[start_sample:end_sample]
    
    # Compute STFT
    D = librosa.stft(y, n_fft=N_FFT, hop_length=HOP_LENGTH)
    S_db = librosa.amplitude_to_db(np.abs(D), ref=np.max)
    
    # Plot spectrogram
    img = librosa.display.specshow(
        S_db, 
        sr=SR, 
        hop_length=HOP_LENGTH, 
        x_axis='time', 
        y_axis='log', 
        cmap='magma',
        ax=ax
    )
    
    # Add title
    ax.set_title(f['label'], fontsize=14, fontweight='bold')
    
    # Clean up labels
    if idx in [0, 1]:  # Top row
        ax.set_xlabel('')
    else:
        ax.set_xlabel('Time (s)', fontsize=11)
    
    if idx in [1, 3]:  # Right column
        ax.set_ylabel('')
    else:
        ax.set_ylabel('Frequency (Hz)', fontsize=11)

# Add colorbar
fig.subplots_adjust(right=0.88, hspace=0.25, wspace=0.15)
cbar_ax = fig.add_axes([0.90, 0.15, 0.02, 0.7])
cbar = fig.colorbar(img, cax=cbar_ax)
cbar.set_label('Magnitude (dB)', fontsize=11)

# Main title
# fig.suptitle('Classifier-Free Guidance: Effect of Guidance Scale on Audio Enhancement', 
#              fontsize=14, fontweight='bold', y=0.98)

# Save figure - high quality for paper
# PNG at 600 DPI for raster
plt.savefig('static/figures/cfg_comparison_2x2.png', dpi=600, bbox_inches='tight', 
            facecolor='white', edgecolor='none', pad_inches=0.05)
# PDF vector format (best for LaTeX papers)
plt.savefig('static/figures/cfg_comparison_2x2.pdf', bbox_inches='tight', 
            facecolor='white', edgecolor='none', pad_inches=0.05)
# EPS format (alternative for LaTeX)
plt.savefig('static/figures/cfg_comparison_2x2.eps', bbox_inches='tight', 
            facecolor='white', edgecolor='none', pad_inches=0.05)

print("✓ Saved: static/figures/cfg_comparison_2x2.png (600 DPI)")
print("✓ Saved: static/figures/cfg_comparison_2x2.pdf (vector)")
print("✓ Saved: static/figures/cfg_comparison_2x2.eps (vector)")

plt.close()
