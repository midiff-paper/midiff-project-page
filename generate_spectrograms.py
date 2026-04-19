import librosa
import librosa.display
import matplotlib.pyplot as plt
import numpy as np
import os
import soundfile as sf

def trim_audio_last_seconds(audio_path, output_path, last_seconds=5):
    """Trim audio to last N seconds and save to output_path."""
    y, sr = librosa.load(audio_path, sr=None)
    n_samples = int(sr * last_seconds)
    y_trimmed = y[-n_samples:] if len(y) > n_samples else y
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    sf.write(output_path, y_trimmed, sr)
    print(f"✓ Trimmed to last {last_seconds}s: {output_path}")


def generate_spectrogram(audio_path, output_path, duration=None, last_seconds=None):
    """Generate a spectrogram from audio. If last_seconds is set, use only the last N seconds."""
    print(f"Loading audio: {audio_path}")
    
    # Load full audio
    y, sr = librosa.load(audio_path, sr=None)
    total_duration = len(y) / sr
    
    if last_seconds is not None:
        # Trim to last N seconds
        n_samples = int(sr * last_seconds)
        y = y[-n_samples:] if len(y) > n_samples else y
        total_duration = len(y) / sr
        print(f"  Total duration: {total_duration:.2f}s (last {last_seconds}s of file)")
    else:
        print(f"  Total duration: {total_duration:.2f}s")
    print(f"  Generating spectrogram")
    
    # Compute STFT
    D = librosa.stft(y, n_fft=1024, hop_length=128)
    stft_db = librosa.amplitude_to_db(np.abs(D), ref=np.max)
    
    # Calculate width based on duration (wider for longer audio)
    # Use approximately 100 pixels per second for good detail
    width_in_inches = max(8, total_duration * 1.2)  # At least 8 inches, scale with duration
    
    # Create figure with dynamic width
    fig = plt.figure(figsize=(width_in_inches, 3), facecolor='none')
    ax = fig.add_subplot(111)
    
    # Plot spectrogram with better color scheme
    img = librosa.display.specshow(stft_db, x_axis='time', y_axis='log', 
                                    ax=ax, sr=sr, cmap='magma')
    
    # Remove axes for cleaner look
    ax.set_xlabel('')
    ax.set_ylabel('')
    ax.set_xticks([])
    ax.set_yticks([])
    
    # Remove frame
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['bottom'].set_visible(False)
    ax.spines['left'].set_visible(False)
    
    # Save with tight layout
    plt.tight_layout(pad=0)
    plt.savefig(output_path, dpi=150, bbox_inches='tight', 
                pad_inches=0, transparent=False, facecolor='#1a1a2e')
    plt.close()
    
    print(f"✓ Saved full-length spectrogram: {output_path} ({width_in_inches:.1f} inches wide)")

if __name__ == "__main__":
    # Generate spectrograms for clean and noisy audio
    # audio_files = [
    #     ("static/clean_10_soul-groove10_102_4-4_bluebird.wav", 
    #      "static/images/spec_clean.png"),
    #     ("static/noisy_10_soul-groove10_102_4-4_bluebird_v1_noisy.wav", 
    #      "static/images/spec_noisy.png")
    # ]
    
    # # Add baseline folder spectrograms
    baseline_files = [
        "epoch=0_10_soul-groove10_102_4-4_bluebird_v1_noisy.wav",
        "epoch=10_10_soul-groove10_102_4-4_bluebird_v1_noisy.wav",
        "epoch=20_10_soul-groove10_102_4-4_bluebird_v1_noisy.wav",
        "epoch=30_10_soul-groove10_102_4-4_bluebird_v1_noisy.wav"
    ]
    audio_files = []
    epochs = [0, 10, 20, 30, 40, 50]
    for epoch in epochs:
        audio_path = f"static/audio/baseline/version_83/enhancement/use_midi=False_epoch_{epoch}/drummer1_1_funk-groove1_138_beat_4-4_bluebird.wav"
        output_path = f"static/images/baseline_epoch_{epoch}.png"
        audio_files.append((audio_path, output_path))
    
    for epoch in epochs:
        audio_path = f"static/audio/midi_conditioned/version_86/enhancement/use_midi=True_epoch_{epoch}/drummer1_1_funk-groove1_138_beat_4-4_bluebird.wav"
        output_path = f"static/images/midi_film_conditioned_epoch_{epoch}.png"
        audio_files.append((audio_path, output_path))

    # Velocity sweep v181: trim to last 5s and generate spectrograms (drummer1_1_funk-groove1_138_beat_4-4_bluebird)
    velocity_sweep_f = "drummer1_1_funk-groove1_138_beat_4-4_bluebird.wav"
    velocity_sweep_dirs = ["velocity_0", "velocity_1", "velocity_20", "velocity_40", "velocity_60", "velocity_80", "velocity_100", "velocity_127", "random_velocity"]
    for d in velocity_sweep_dirs:
        src = f"static/audio/midi_conditioned/velocity_sweep_v181/{d}/{velocity_sweep_f}"
        dst = f"static/audio/midi_conditioned/velocity_sweep_v181_last5/{d}/{velocity_sweep_f}"
        if os.path.exists(src):
            trim_audio_last_seconds(src, dst, last_seconds=5)
    for d in velocity_sweep_dirs:
        audio_path = f"static/audio/midi_conditioned/velocity_sweep_v181/{d}/{velocity_sweep_f}"
        output_path = f"static/images/velocity_sweep_v181_{d}.png"
        audio_files.append((audio_path, output_path, 5))  # last_seconds=5 for spectrogram

    # Add Best FAD Comparison spectrograms (Baseline v180, MiDiff v181)
    best_fad_filenames = [
        'drummer1_1_funk-groove1_138_beat_4-4_bluebird.wav',
        'drummer1_2_funk-groove2_105_beat_4-4_brooklyn.wav',
        'drummer1_3_soul-groove3_86_beat_4-4_detroit_garage.wav',
        'drummer1_4_soul-groove4_80_beat_4-4_east_bay.wav',
        'drummer1_5_funk-groove5_84_beat_4-4_heavy.wav',
        'drummer1_6_hiphop-groove6_87_beat_4-4_motown_revisited.wav',
        'drummer1_7_pop-groove7_138_beat_4-4_portland.wav',
        'drummer1_8_rock-groove8_65_beat_4-4_retro_rock.wav',
        'drummer1_9_soul-groove9_105_beat_4-4_roots.wav',
        'drummer1_10_soul-groove10_102_beat_4-4_socal.wav',
    ]
    # Create 5-second trimmed audio for Best FAD (play only last 5s)
    for f in best_fad_filenames:
        trim_audio_last_seconds(
            f"static/audio/baseline/version_180/{f}",
            f"static/audio/baseline/version_180_last5/{f}",
            last_seconds=5
        )
        trim_audio_last_seconds(
            f"static/audio/midi_conditioned/version_181/{f}",
            f"static/audio/midi_conditioned/version_181_last5/{f}",
            last_seconds=5
        )

    best_fad_entries = []
    for f in best_fad_filenames:
        base = f.replace('.wav', '')
        best_fad_entries.append((
            f"static/audio/baseline/version_180/{f}",
            f"static/images/baseline_v180_{base}.png",
            5  # last_seconds for spectrogram
        ))
        best_fad_entries.append((
            f"static/audio/midi_conditioned/version_181/{f}",
            f"static/images/midiff_v181_{base}.png",
            5  # last_seconds for spectrogram
        ))

    # Add CFG spectrograms
    cfg_files = [
        # Baseline (w=0)
        ("static/audio/baseline/version_83/enhancement/use_midi=False_epoch_50/drummer1_1_funk-groove1_138_beat_4-4_bluebird.wav",
         "static/images/cfg_baseline.png"),
        # w=1.0
        ("static/audio/midi_conditioned/cfg/w_1.0/drummer1_1_funk-groove1_138_beat_4-4_bluebird.wav",
         "static/images/cfg_w_1.0.png"),
        # w=2.0
        ("static/audio/midi_conditioned/cfg/w_2.0/drummer1_1_funk-groove1_138_beat_4-4_bluebird.wav",
         "static/images/cfg_w_2.0.png"),
        # w=3.0
        ("static/audio/midi_conditioned/cfg/w_3.0/drummer1_1_funk-groove1_138_beat_4-4_bluebird.wav",
         "static/images/cfg_w_3.0.png"),
    ]
    audio_files.extend(cfg_files)

    # Dataset section: clean and noisy from static/audio/dataset
    dataset_files = [
        ("static/audio/dataset/clean/drummer1_1_funk-groove1_138_beat_4-4_bluebird.wav", "static/images/spec_clean.png"),
        ("static/audio/dataset/noisy/drummer1_1_funk-groove1_138_beat_4-4_bluebird.wav", "static/images/spec_noisy.png"),
    ]
    audio_files.extend(dataset_files)

    for item in audio_files:
        audio_path, output_path = item[0], item[1]
        last_seconds = item[2] if len(item) > 2 else None
        if os.path.exists(audio_path):
            generate_spectrogram(audio_path, output_path, last_seconds=last_seconds)
        else:
            print(f"Warning: Audio file not found: {audio_path}")

    for item in best_fad_entries:
        audio_path, output_path, last_seconds = item
        if os.path.exists(audio_path):
            generate_spectrogram(audio_path, output_path, last_seconds=last_seconds)
        else:
            print(f"Warning: Audio file not found: {audio_path}")
    
    print("\n✓ All spectrograms generated successfully!")
