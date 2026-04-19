import pretty_midi
import matplotlib.pyplot as plt
import numpy as np
import os

def generate_piano_roll(midi_path, output_path, duration=None):
    """Generate a compact piano roll visualization from MIDI file"""
    print(f"Loading MIDI: {midi_path}")
    
    # Load MIDI file
    midi_data = pretty_midi.PrettyMIDI(midi_path)
    
    # Get total duration
    total_duration = midi_data.get_end_time()
    
    # Show entire MIDI file
    start_time = 0
    end_time = total_duration
    
    print(f"  Total duration: {total_duration:.2f}s")
    print(f"  Showing full range: {start_time:.2f}s to {end_time:.2f}s")
    
    # Create wider figure for scrolling (more horizontal space per second)
    # Use ~2 inches per second for readable notes
    width = max(10, total_duration * 2)
    fig = plt.figure(figsize=(width, 2.85), facecolor='#1a1a2e', dpi=150)
    ax = fig.add_subplot(111)
    ax.set_facecolor('#1a1a2e')
    
    # Collect notes in the time range
    notes_in_range = []
    for instrument in midi_data.instruments:
        for note in instrument.notes:
            if start_time <= note.start <= end_time or start_time <= note.end <= end_time:
                notes_in_range.append(note)
    
    print(f"  Found {len(notes_in_range)} notes in range")
    
    if len(notes_in_range) > 0:
        # Plot each note as a colored rectangle (smaller height for more notes)
        for note in notes_in_range:
            note_start = max(note.start, start_time)
            note_end = min(note.end, end_time)
            note_duration = note_end - note_start
            
            # Use velocity to determine color intensity
            alpha = 0.4 + (note.velocity / 127.0) * 0.6
            
            # Draw note as a larger rectangle for better visibility
            rect = plt.Rectangle((note_start, note.pitch), 
                                note_duration, 0.8,
                                facecolor='#28a745', 
                                edgecolor='#20c997',
                                alpha=alpha,
                                linewidth=0.5)
            ax.add_patch(rect)
    else:
        # If no notes, show message
        ax.text(start_time + duration/2, 64, 'No notes in this range', 
                ha='center', va='center', color='#28a745', fontsize=12)
    
    # Set axis limits
    ax.set_xlim(start_time, end_time)
    
    # Find note range
    if len(notes_in_range) > 0:
        pitches = [n.pitch for n in notes_in_range]
        min_pitch = max(0, min(pitches) - 2)
        max_pitch = min(127, max(pitches) + 2)
    else:
        min_pitch = 36
        max_pitch = 84
    
    ax.set_ylim(min_pitch, max_pitch)
    
    # Add subtle grid
    ax.grid(True, alpha=0.1, color='#28a745', linestyle='-', linewidth=0.5)
    
    # Style the plot
    ax.set_xlabel('')
    ax.set_ylabel('')
    ax.set_xticks([])
    ax.set_yticks([])
    
    # Remove frame but keep dark background
    for spine in ax.spines.values():
        spine.set_edgecolor('#28a745')
        spine.set_linewidth(0.5)
        spine.set_alpha(0.3)
    
    # Save with transparent edges
    plt.tight_layout(pad=0.1)
    plt.savefig(output_path, facecolor='#1a1a2e', edgecolor='none', 
                bbox_inches='tight', pad_inches=0.05, dpi=150, transparent=False)
    plt.close()
    
    print(f"  Saved piano roll to: {output_path}")
    print(f"  Note range: {min_pitch} to {max_pitch}")
    print(f"  Image width: {width * 150}px (for {total_duration:.2f}s)")
    
    return total_duration  # Return duration for HTML metadata

if __name__ == '__main__':
    # Path to MIDI file
    midi_file = 'static/1_funk-groove1_138_beat_4-4.mid'
    output_file = 'static/images/piano_roll_midi.png'
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    # Generate piano roll - show entire file
    if os.path.exists(midi_file):
        duration = generate_piano_roll(midi_file, output_file, duration=None)
        print("\nPiano roll generated successfully!")
        print(f"Duration: {duration:.2f}s")
    else:
        print(f"Error: MIDI file not found: {midi_file}")
