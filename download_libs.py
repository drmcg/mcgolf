#!/usr/bin/env python3
import urllib.request
import os
import sys

lib_dir = os.path.join(os.path.dirname(__file__), 'lib')
os.makedirs(lib_dir, exist_ok=True)

files = {
    'three.min.js': 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js',
    'OrbitControls.js': 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/js/controls/OrbitControls.js'
}

for filename, url in files.items():
    filepath = os.path.join(lib_dir, filename)
    print(f"Downloading {filename}...")
    try:
        urllib.request.urlretrieve(url, filepath)
        size = os.path.getsize(filepath) / 1024
        print(f"✓ {filename} - {size:.1f} KB")
    except Exception as e:
        print(f"✗ Failed to download {filename}: {e}")
        sys.exit(1)

print("\nLibraries downloaded successfully!")
