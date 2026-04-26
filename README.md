# 3D Golf Game

This browser-based 3D golf game uses Three.js and procedural course generation. Play a full 9-hole course with realistic shot mechanics, terrain physics, and scoring.

## Features

- **9-Hole Course**: Complete a full course with procedurally generated holes
- **Multiple Clubs**: Choose from Driver, 3-Wood, 5-Iron, 9-Iron, and Putter with different distance/accuracy tradeoffs
- **Terrain Variety**: Navigate fairways, rough, sand bunkers, water hazards, and out-of-bounds areas
- **Terrain Height Variation**: Hills and slopes add visual depth and affect ball movement
- **Aiming Indicator**: Visual line shows your intended shot direction and distance
- **Par System**: Each hole has a calculated par, track your score relative to par
- **Realistic Physics**: Terrain type affects ball distance and velocity
- **Shot Accuracy**: Club accuracy determines how much your shot can deviate from intended direction

## Project Plan

- [x] Scaffold HTML/CSS/JS files
- [x] Add Three.js scene, camera, and lighting
- [x] Create random course with tee, hole, fairway, green, sand, water, rough, and out-of-bounds
- [x] Add multiple clubs with different distance and accuracy attributes
- [x] Add power slider and hit button
- [x] Implement shot mechanics and terrain impact on distance
- [x] Display shot count and distance to hole
- [x] Add advanced aiming controls and better course visuals (aiming line, terrain height variation)
- [x] Add scoring, par, and full course progression (9 holes)

## Run

Open `index.html` in a web browser. For best results, use a local server such as:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.
