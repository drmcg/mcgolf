const canvasContainer = document.getElementById('canvasContainer');
const clubSelect = document.getElementById('club');
const powerInput = document.getElementById('power');
const powerValue = document.getElementById('powerValue');
const aimInput = document.getElementById('aim');
const aimValue = document.getElementById('aimValue');
const hitButton = document.getElementById('hitButton');
const nextHoleButton = document.getElementById('nextHoleButton');
const status = document.getElementById('status');
const shotCountLabel = document.getElementById('shotCount');
const distanceLabel = document.getElementById('distanceToHole');
const holeNumberLabel = document.getElementById('holeNumber');
const parLabel = document.getElementById('par');
const courseScoreDisplay = document.getElementById('courseScoreDisplay');

const CLUBS = [
  { name: 'Driver', factor: 1.5, accuracy: 0.75, description: 'Longest distance, less control.' },
  { name: '3-Wood', factor: 1.3, accuracy: 0.82, description: 'Good distance, decent accuracy.' },
  { name: '5-Iron', factor: 1.1, accuracy: 0.9, description: 'Balanced shot for fairway play.' },
  { name: '9-Iron', factor: 0.8, accuracy: 0.95, description: 'Shorter shot with more precision.' },
  { name: 'Putter', factor: 0.45, accuracy: 0.98, description: 'For greens and finishing strokes.' }
];

const TERRAIN = {
  fairway: { color: 0x4f7942, multiplier: 1.0 },
  rough: { color: 0x2f4f2f, multiplier: 0.72 },
  sand: { color: 0xc9b27c, multiplier: 0.55 },
  water: { color: 0x1e3f66, multiplier: 0.36 },
  out: { color: 0x4a4a4a, multiplier: 0.18 },
  green: { color: 0x75aa5f, multiplier: 0.9 }
};

const COURSE_SIZE = 160;
const TILE_SIZE = 4;
const GRID_SIZE = COURSE_SIZE / TILE_SIZE;

let scene, camera, renderer, controls;
let ballMesh, holeMesh;
let courseGrid = [];
let teeCell = null;
let holeCell = null;
let shotCount = 0;
let velocity = 0;
let ballPosition = new THREE.Vector3();
let targetVector = new THREE.Vector3();
let inMotion = false;
let currentClub = CLUBS[0];
let aimAngle = 0;
let aimingLine = null;
let currentHole = 1;
const TOTAL_HOLES = 9;
let courseScore = [];
let terrainHeightMap = [];
let terrainMesh = null;

function init() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
  camera.position.set(0, 80, 100);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  canvasContainer.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.update();
  controls.enablePan = false;
  controls.minDistance = 30;
  controls.maxDistance = 250;

  const ambient = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambient);
  const directional = new THREE.DirectionalLight(0xffffff, 0.7);
  directional.position.set(30, 100, 50);
  scene.add(directional);

  buildCourse();
  createBall();
  createHole();

  fillClubList();
  courseScore = [];
  aimInput.addEventListener('input', () => {
    aimValue.textContent = aimInput.value;
    aimAngle = Number(aimInput.value);
    createAimingLine();
  });
  updateStatus(`Hole 1 - Choose your club, power, and aim.`);
  createAimingLine();
  updateHUD();
  animate();
}

function fillClubList() {
  CLUBS.forEach((club, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.innerText = club.name;
    clubSelect.appendChild(option);
  });
  clubSelect.addEventListener('change', () => {
    currentClub = CLUBS[clubSelect.selectedIndex];
    updateStatus(`Club selected: ${currentClub.name}. ${currentClub.description}`);
    createAimingLine();
  });
}

function clearTerrainMeshes() {
  if (terrainMesh) {
    scene.remove(terrainMesh);
    terrainMesh.geometry.dispose();
    terrainMesh.material.dispose();
    terrainMesh = null;
  }
}

function buildCourse() {
  clearTerrainMeshes();
  courseGrid = [];
  terrainHeightMap = [];
  const grid = [];
  
  // Initialize grid and height map with more varied terrain
  for (let x = 0; x < GRID_SIZE; x += 1) {
    grid[x] = [];
    terrainHeightMap[x] = [];
    for (let z = 0; z < GRID_SIZE; z += 1) {
      grid[x][z] = 'rough';
      // Create more varied hills and valleys with multiple octaves
      const baseHeight = Math.sin(x * 0.08) * Math.cos(z * 0.08) * 2.5;
      const hillNoise1 = Math.sin(x * 0.15) * Math.cos(z * 0.12) * 2;
      const hillNoise2 = Math.sin(x * 0.25) * Math.cos(z * 0.2) * 1;
      const valleyNoise = Math.sin(x * 0.05 + z * 0.03) * 1.2;
      const ridgeNoise = Math.sin(x * 0.03 + z * 0.04) * 1.5;
      terrainHeightMap[x][z] = baseHeight + hillNoise1 + hillNoise2 + valleyNoise + ridgeNoise;
      
      // Add some extreme variations occasionally
      if (Math.random() < 0.02) {
        terrainHeightMap[x][z] += (Math.random() - 0.5) * 3;
      }
    }
  }

  const path = createRandomFairwayPath();
  createVariableWidthFairway(grid, path);
  createLargeGreen(grid, path);
  placeIntersectingObstacles(grid, path);
  createTerrainMeshes(grid);
  courseGrid = grid;
}

function createRandomFairwayPath() {
  const startX = 2;
  const startZ = Math.floor(GRID_SIZE / 4) + Math.floor(Math.random() * 3);
  const endX = GRID_SIZE - 3;
  const endZ = Math.floor((GRID_SIZE * 3) / 4) + Math.floor(Math.random() * 3);

  const path = [];
  let current = { x: startX, z: startZ };
  path.push({ ...current });

  while (current.x < endX || Math.abs(current.z - endZ) > 0) {
    const step = [];
    if (current.x < endX) step.push({ x: current.x + 1, z: current.z });
    if (current.z < endZ) step.push({ x: current.x, z: current.z + 1 });
    if (current.z > endZ) step.push({ x: current.x, z: current.z - 1 });
    const next = step[Math.floor(Math.random() * step.length)];
    current = next;
    path.push({ ...current });
    if (path.length > GRID_SIZE * 4) break;
  }

  teeCell = path[0];
  holeCell = path[path.length - 1];
  return path;
}

function createVariableWidthFairway(grid, path) {
  path.forEach((cell, index) => {
    // Vary fairway width along the path (2-5 tiles wide)
    const width = Math.floor(Math.random() * 4) + 2; // 2 to 5 tiles wide
    
    for (let dx = -width; dx <= width; dx++) {
      for (let dz = -width; dz <= width; dz++) {
        const nx = cell.x + dx;
        const nz = cell.z + dz;
        
        // Check if within bounds and within circular radius
        if (nx >= 0 && nx < GRID_SIZE && nz >= 0 && nz < GRID_SIZE) {
          const distance = Math.sqrt(dx * dx + dz * dz);
          if (distance <= width) {
            if (index === path.length - 1) {
              // Green area handled separately
              continue;
            } else {
              grid[nx][nz] = 'fairway';
              // More varied fairway heights with gentle undulations
              const baseHeight = 0.05 + Math.random() * 0.1;
              const undulation = Math.sin(nx * 0.3) * Math.cos(nz * 0.3) * 0.15;
              terrainHeightMap[nx][nz] = baseHeight + undulation;
            }
          }
        }
      }
    }
  });
  
  // Add some fairway bunkers near the green
  const greenCell = path[path.length - 1];
  const bunkerCount = Math.floor(Math.random() * 2) + 1; // 1-2 bunkers near green
  
  for (let i = 0; i < bunkerCount; i++) {
    const angle = (Math.PI * 2 * i) / bunkerCount + Math.random() * 0.5;
    const distance = 2 + Math.random() * 2; // 2-4 tiles from green
    const bunkerX = Math.round(greenCell.x + Math.cos(angle) * distance);
    const bunkerZ = Math.round(greenCell.z + Math.sin(angle) * distance);
    
    if (bunkerX >= 0 && bunkerX < GRID_SIZE && bunkerZ >= 0 && bunkerZ < GRID_SIZE) {
      if (grid[bunkerX][bunkerZ] === 'fairway') {
        const bunkerSize = Math.floor(Math.random() * 2) + 1; // 1-2 radius
        createIrregularObstacle(grid, bunkerX, bunkerZ, bunkerSize, 'sand');
      }
    }
  }
}

function createLargeGreen(grid, path) {
  const holeCell = path[path.length - 1];
  const greenRadius = 3; // 3 tiles radius around hole
  
  for (let dx = -greenRadius; dx <= greenRadius; dx++) {
    for (let dz = -greenRadius; dz <= greenRadius; dz++) {
      const nx = holeCell.x + dx;
      const nz = holeCell.z + dz;
      
      if (nx >= 0 && nx < GRID_SIZE && nz >= 0 && nz < GRID_SIZE) {
        const distance = Math.sqrt(dx * dx + dz * dz);
        if (distance <= greenRadius) {
          grid[nx][nz] = 'green';
          // Create more interesting green contours with subtle breaks
          const baseHeight = 0.1;
          const slopeBreak = Math.sin(nx * 0.5) * Math.cos(nz * 0.5) * 0.08;
          const microUndulations = Math.sin(nx * 1.2) * Math.cos(nz * 1.2) * 0.02;
          const distanceFalloff = (greenRadius - distance) * 0.01; // Slight slope toward hole
          terrainHeightMap[nx][nz] = baseHeight + slopeBreak + microUndulations + distanceFalloff;
        }
      }
    }
  }
}

function placeIntersectingObstacles(grid, path) {
  // Create large contiguous water features (lakes)
  const lakeCount = Math.floor(Math.random() * 3) + 1; // 1-3 lakes per course
  
  for (let lake = 0; lake < lakeCount; lake++) {
    // Place lake away from fairway and green
    let lakeX, lakeZ, attempts = 0;
    do {
      lakeX = Math.floor(Math.random() * (GRID_SIZE - 8)) + 4;
      lakeZ = Math.floor(Math.random() * (GRID_SIZE - 8)) + 4;
      attempts++;
    } while (attempts < 50 && isNearFairway(lakeX, lakeZ, path, 3));
    
    if (attempts < 50) {
      // Create irregular lake shape
      const lakeSize = Math.floor(Math.random() * 4) + 4; // 4-7 radius
      createIrregularObstacle(grid, lakeX, lakeZ, lakeSize, 'water');
    }
  }
  
  // Create medium sand traps
  const sandTrapCount = Math.floor(Math.random() * 4) + 2; // 2-5 sand traps
  
  for (let trap = 0; trap < sandTrapCount; trap++) {
    let trapX, trapZ, attempts = 0;
    do {
      trapX = Math.floor(Math.random() * (GRID_SIZE - 6)) + 3;
      trapZ = Math.floor(Math.random() * (GRID_SIZE - 6)) + 3;
      attempts++;
    } while (attempts < 50 && isNearFairway(trapX, trapZ, path, 2));
    
    if (attempts < 50) {
      const trapSize = Math.floor(Math.random() * 3) + 2; // 2-4 radius
      createIrregularObstacle(grid, trapX, trapZ, trapSize, 'sand');
    }
  }
  
  // Create crossing obstacles that intersect fairway
  const crossingCount = Math.floor(Math.random() * 3) + 1; // 1-3 crossing obstacles
  
  for (let i = 0; i < crossingCount; i++) {
    const pathIndex = Math.floor(Math.random() * (path.length - 8)) + 4; // Avoid start/end
    const pathCell = path[pathIndex];
    
    const direction = Math.random() < 0.5 ? 'horizontal' : 'vertical';
    const length = Math.floor(Math.random() * 4) + 3; // 3-6 tiles long
    const obstacleType = Math.random() < 0.6 ? 'water' : 'sand';
    
    if (direction === 'horizontal') {
      for (let dz = -length; dz <= length; dz++) {
        const nz = pathCell.z + dz;
        if (nz >= 0 && nz < GRID_SIZE && grid[pathCell.x][nz] === 'fairway') {
          grid[pathCell.x][nz] = obstacleType;
        }
      }
    } else {
      for (let dx = -length; dx <= length; dx++) {
        const nx = pathCell.x + dx;
        if (nx >= 0 && nx < GRID_SIZE && grid[nx][pathCell.z] === 'fairway') {
          grid[nx][pathCell.z] = obstacleType;
        }
      }
    }
  }
  
  // Add some small rough patches and out-of-bounds areas
  const roughPatchCount = Math.floor(Math.random() * 6) + 4; // 4-9 rough patches
  
  for (let i = 0; i < roughPatchCount; i++) {
    const patchX = Math.floor(Math.random() * GRID_SIZE);
    const patchZ = Math.floor(Math.random() * GRID_SIZE);
    
    if (grid[patchX][patchZ] === 'rough') {
      const patchSize = Math.floor(Math.random() * 2) + 1; // 1-2 radius
      createIrregularObstacle(grid, patchX, patchZ, patchSize, Math.random() < 0.7 ? 'rough' : 'out');
    }
  }
}

function isNearFairway(x, z, path, minDistance) {
  return path.some(cell => {
    const distance = Math.sqrt((cell.x - x) ** 2 + (cell.z - z) ** 2);
    return distance < minDistance;
  });
}

function createIrregularObstacle(grid, centerX, centerZ, radius, type) {
  // Create irregular shapes by using noise to vary the boundary
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const x = centerX + dx;
      const z = centerZ + dz;
      
      if (x >= 0 && x < GRID_SIZE && z >= 0 && z < GRID_SIZE) {
        const distance = Math.sqrt(dx * dx + dz * dz);
        // Add some noise to make irregular shapes
        const noise = (Math.sin(x * 0.5) + Math.cos(z * 0.5)) * 0.3;
        const effectiveRadius = radius + noise;
        
        if (distance <= effectiveRadius && grid[x][z] !== 'fairway' && grid[x][z] !== 'green') {
          grid[x][z] = type;
        }
      }
    }
  }
}

function createTerrainMeshes(grid) {
  const vertexCount = GRID_SIZE * GRID_SIZE;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = new Uint16Array((GRID_SIZE - 1) * (GRID_SIZE - 1) * 6);
  const heightValues = [];

  for (let x = 0; x < GRID_SIZE; x += 1) {
    heightValues[x] = [];
    for (let z = 0; z < GRID_SIZE; z += 1) {
      const type = grid[x][z];
      const baseHeight = terrainHeightMap[x][z];
      heightValues[x][z] = baseHeight + (type === 'sand' ? 0.05 : type === 'water' ? -0.1 : 0);
    }
  }

  let posIndex = 0;
  let uvIndex = 0;
  for (let z = 0; z < GRID_SIZE; z += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const worldX = (x - GRID_SIZE / 2) * TILE_SIZE + TILE_SIZE / 2;
      const worldZ = (z - GRID_SIZE / 2) * TILE_SIZE + TILE_SIZE / 2;
      const type = grid[x][z];
      const height = heightValues[x][z];

      positions[posIndex] = worldX;
      positions[posIndex + 1] = height;
      positions[posIndex + 2] = worldZ;

      const left = heightValues[Math.max(x - 1, 0)][z];
      const right = heightValues[Math.min(x + 1, GRID_SIZE - 1)][z];
      const down = heightValues[x][Math.max(z - 1, 0)];
      const up = heightValues[x][Math.min(z + 1, GRID_SIZE - 1)];
      const normal = new THREE.Vector3((left - right) / (2 * TILE_SIZE), 1, (down - up) / (2 * TILE_SIZE)).normalize();

      normals[posIndex] = normal.x;
      normals[posIndex + 1] = normal.y;
      normals[posIndex + 2] = normal.z;

      const color = new THREE.Color(TERRAIN[type].color);
      colors[posIndex] = color.r;
      colors[posIndex + 1] = color.g;
      colors[posIndex + 2] = color.b;

      uvs[uvIndex++] = x / (GRID_SIZE - 1);
      uvs[uvIndex++] = z / (GRID_SIZE - 1);

      posIndex += 3;
    }
  }

  let index = 0;
  for (let z = 0; z < GRID_SIZE - 1; z += 1) {
    for (let x = 0; x < GRID_SIZE - 1; x += 1) {
      const a = z * GRID_SIZE + x;
      const b = a + GRID_SIZE;
      const c = b + 1;
      const d = a + 1;

      indices[index++] = a;
      indices[index++] = b;
      indices[index++] = d;
      indices[index++] = b;
      indices[index++] = c;
      indices[index++] = d;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: false });
  terrainMesh = new THREE.Mesh(geometry, material);
  scene.add(terrainMesh);
}

function createBall() {
  const geometry = new THREE.SphereGeometry(1.2, 24, 24);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.2, roughness: 0.4 });
  ballMesh = new THREE.Mesh(geometry, material);
  scene.add(ballMesh);
  resetBall();
}

function createHole() {
  const torus = new THREE.TorusGeometry(2.2, 0.3, 16, 100);
  const material = new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 0.6, roughness: 0.4 });
  holeMesh = new THREE.Mesh(torus, material);
  holeMesh.rotation.x = Math.PI / 2;
  scene.add(holeMesh);
  placeHole();
}

function resetBall() {
  const pos = cellToWorld(teeCell);
  const height = getTerrainHeightAt(pos.x, pos.z);
  ballPosition.set(pos.x, height + 1.2, pos.z);
  ballMesh.position.copy(ballPosition);
  velocity = 0;
  inMotion = false;
  shotCount = 0;
}

function placeHole() {
  const pos = cellToWorld(holeCell);
  const height = getTerrainHeightAt(pos.x, pos.z);
  holeMesh.position.set(pos.x, height + 0.5, pos.z);
}

function createAimingLine() {
  if (inMotion) return;
  if (aimingLine) scene.remove(aimingLine);
  
  const points = [];
  points.push(ballPosition.clone());
  
  // Calculate direction based on current aim setting
  const pathDirection = new THREE.Vector3().subVectors(holeMesh.position, ballMesh.position).setY(0).normalize();
  const aimDegrees = Number(aimInput.value);
  const direction = pathDirection.clone()
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(aimDegrees));
  
  // Calculate preview distance based on current power and club
  const power = Number(powerInput.value) / 100;
  const baseDistance = currentClub.factor * 35;
  const terrain = getTerrainAtBall();
  const terrainMod = TERRAIN[terrain]?.multiplier || 0.7;
  const previewDistance = baseDistance * power * terrainMod;
  
  const previewEnd = new THREE.Vector3().copy(ballPosition).addScaledVector(direction, previewDistance);
  points.push(previewEnd);
  
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0xffaa00, linewidth: 3 });
  aimingLine = new THREE.Line(geometry, material);
  scene.add(aimingLine);
}

function calculatePar() {
  const distance = cellToWorld(teeCell).distance = Math.hypot(
    cellToWorld(teeCell).x - cellToWorld(holeCell).x,
    cellToWorld(teeCell).z - cellToWorld(holeCell).z
  );
  // Rough par estimate: 35 units per stroke
  if (distance < 50) return 3;
  if (distance < 100) return 4;
  return 5;
}

function updateCourseScoreDisplay() {
  let html = '<div style="font-size: 11px; color: #64748b; letter-spacing: 2px;">';
  for (let i = 1; i <= TOTAL_HOLES; i++) {
    const score = courseScore[i - 1];
    const scoreClass = score ? (score <= calculatePar() ? 'under' : 'over') : '';
    html += `<span style="display: inline-block; width: 24px; ${score ? 'color: #e2e8f0;' : ''}">${score || '•'}</span>`;
  }
  html += '</div>';
  courseScoreDisplay.innerHTML = html;
}

function cellToWorld(cell) {
  return {
    x: (cell.x - GRID_SIZE / 2) * TILE_SIZE + TILE_SIZE / 2,
    z: (cell.z - GRID_SIZE / 2) * TILE_SIZE + TILE_SIZE / 2
  };
}

function updateHUD() {
  powerValue.textContent = powerInput.value;
  aimValue.textContent = aimInput.value;
  const par = calculatePar();
  parLabel.textContent = par;
  holeNumberLabel.textContent = currentHole;
  const dist = Math.max(0, ballMesh.position.distanceTo(holeMesh.position)).toFixed(1);
  distanceLabel.textContent = dist;
  shotCountLabel.textContent = shotCount;
  updateCourseScoreDisplay();
}

function updateStatus(text) {
  status.innerText = text;
}

function getTerrainAtBall() {
  const xIndex = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor((ballMesh.position.x + (GRID_SIZE * TILE_SIZE) / 2) / TILE_SIZE)));
  const zIndex = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor((ballMesh.position.z + (GRID_SIZE * TILE_SIZE) / 2) / TILE_SIZE)));
  return courseGrid[xIndex][zIndex] || 'rough';
}

function getTerrainHeightAt(x, z) {
  const gridX = (x + (GRID_SIZE * TILE_SIZE) / 2) / TILE_SIZE;
  const gridZ = (z + (GRID_SIZE * TILE_SIZE) / 2) / TILE_SIZE;
  const x0 = Math.floor(gridX);
  const z0 = Math.floor(gridZ);
  const x1 = Math.min(GRID_SIZE - 1, x0 + 1);
  const z1 = Math.min(GRID_SIZE - 1, z0 + 1);
  const sx = gridX - x0;
  const sz = gridZ - z0;

  const sample = (ix, iz) => {
    if (ix < 0 || ix >= GRID_SIZE || iz < 0 || iz >= GRID_SIZE) return 0;
    const type = courseGrid[ix][iz] || 'rough';
    let height = terrainHeightMap[ix][iz] || 0;
    if (type === 'sand') height += 0.05;
    if (type === 'water') height -= 0.1;
    return height;
  };

  const h00 = sample(x0, z0);
  const h10 = sample(x1, z0);
  const h01 = sample(x0, z1);
  const h11 = sample(x1, z1);
  const hx0 = THREE.MathUtils.lerp(h00, h10, sx);
  const hx1 = THREE.MathUtils.lerp(h01, h11, sx);
  return THREE.MathUtils.lerp(hx0, hx1, sz);
}

function computeShot() {
  const power = Number(powerInput.value) / 100;
  const baseDistance = currentClub.factor * 35;
  const pathDirection = new THREE.Vector3().subVectors(holeMesh.position, ballMesh.position).setY(0).normalize();
  const aimDegrees = Number(aimInput.value);
  const terrain = getTerrainAtBall();
  const terrainMod = TERRAIN[terrain]?.multiplier || 0.7;
  const accuracyLoss = 1 - currentClub.accuracy;
  const randomAim = (Math.random() - 0.5) * accuracyLoss * 10;
  targetVector.copy(pathDirection)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(aimDegrees))
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(randomAim));
  const shotDistance = baseDistance * power * terrainMod;
  velocity = shotDistance / 12;
  createAimingLine();
  return shotDistance;
}

function hitBall() {
  if (inMotion) return;
  if (ballMesh.position.distanceTo(holeMesh.position) < 3) {
    finishHole();
    return;
  }
  shotCount += 1;
  const shotDistance = computeShot();
  inMotion = true;
  updateStatus(`Hit with ${currentClub.name} at ${powerInput.value}% power and ${aimInput.value}° aim. Expected ~${shotDistance.toFixed(1)} m.`);
  updateHUD();
}

function finishHole() {
  courseScore.push(shotCount);
  const par = calculatePar();
  const scoreText = shotCount < par ? `Birdie! ${shotCount}` : shotCount === par ? `Par! ${shotCount}` : `Bogey ${shotCount}`;
  updateStatus(`${scoreText} on hole ${currentHole}. Press Next Hole to continue.`);
  hitButton.style.display = 'none';
  nextHoleButton.style.display = 'block';
}

function nextHole() {
  if (currentHole < TOTAL_HOLES) {
    currentHole += 1;
    shotCount = 0;
    inMotion = false;
    velocity = 0;
    if (aimingLine) scene.remove(aimingLine);
    aimingLine = null;
    buildCourse();
    resetBall();
    placeHole();
    hitButton.style.display = 'block';
    nextHoleButton.style.display = 'none';
    updateStatus(`Hole ${currentHole} - Choose your club and power.`);
    updateHUD();
  } else {
    finishCourse();
  }
}

function finishCourse() {
  let totalScore = courseScore.reduce((a, b) => a + b, 0);
  let parTotal = 0;
  for (let i = 1; i <= TOTAL_HOLES; i++) {
    currentHole = i;
    parTotal += calculatePar();
  }
  const scoreDiff = totalScore - parTotal;
  const scoreLine = scoreDiff < 0 ? `${Math.abs(scoreDiff)} under par` : scoreDiff === 0 ? 'Even par' : `${scoreDiff} over par`;
  updateStatus(`Course Complete! Total: ${totalScore} strokes (${scoreLine})`);
  hitButton.style.display = 'none';
  nextHoleButton.style.display = 'none';
}

function animate() {
  requestAnimationFrame(animate);
  if (inMotion) {
    ballPosition.addScaledVector(targetVector, velocity);
    const terrainHeight = getTerrainHeightAt(ballPosition.x, ballPosition.z);
    ballPosition.y = terrainHeight + 1.2;
    ballMesh.position.copy(ballPosition);
    velocity *= 0.96;
    const terrain = getTerrainAtBall();
    if (velocity > 0.01) {
      velocity *= TERRAIN[terrain].multiplier > 0.8 ? 1 : 0.997;
    } else {
      velocity = 0;
      inMotion = false;
      if (aimingLine) {
        scene.remove(aimingLine);
        aimingLine = null;
      }
      if (ballMesh.position.distanceTo(holeMesh.position) < 3) {
        // Ball in hole
        finishHole();
      } else {
        updateStatus(`Ball stopped on ${terrain}. Choose next shot.`);
        createAimingLine();
      }
    }
    if (ballMesh.position.y < -10) {
      resetBall();
      updateStatus('Ball lost. Reset to tee position.');
    }
  }
  controls.update();
  renderer.render(scene, camera);
  updateHUD();
}

powerInput.addEventListener('input', () => {
  powerValue.textContent = powerInput.value;
  createAimingLine();
});

hitButton.addEventListener('click', hitBall);
nextHoleButton.addEventListener('click', nextHole);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

init();
