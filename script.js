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
let terrainMeshes = [];

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
  });
  updateStatus(`Hole 1 - Choose your club, power, and aim.`);
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
  });
}

function clearTerrainMeshes() {
  terrainMeshes.forEach(mesh => scene.remove(mesh));
  terrainMeshes = [];
}

function buildCourse() {
  clearTerrainMeshes();
  courseGrid = [];
  terrainHeightMap = [];
  const grid = [];
  
  // Initialize grid and height map
  for (let x = 0; x < GRID_SIZE; x += 1) {
    grid[x] = [];
    terrainHeightMap[x] = [];
    for (let z = 0; z < GRID_SIZE; z += 1) {
      grid[x][z] = 'rough';
      // Perlin-like noise for height variation
      terrainHeightMap[x][z] = Math.sin(x * 0.08) * Math.cos(z * 0.08) * 2;
    }
  }

  const path = createRandomFairwayPath();
  path.forEach((cell, index) => {
    grid[cell.x][cell.z] = index === path.length - 1 ? 'green' : 'fairway';
    // Flatten fairway and green
    terrainHeightMap[cell.x][cell.z] = index === path.length - 1 ? 0.1 : 0.05;
  });

  placeObstacles(grid, path);
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

function placeObstacles(grid, path) {
  const obstacleCount = 24;
  for (let i = 0; i < obstacleCount; i += 1) {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const z = Math.floor(Math.random() * GRID_SIZE);
    const inPath = path.some(cell => cell.x === x && cell.z === z);
    if (inPath || grid[x][z] === 'green') continue;
    if (Math.random() < 0.35) grid[x][z] = 'water';
    else if (Math.random() < 0.7) grid[x][z] = 'sand';
    else if (Math.random() < 0.95) grid[x][z] = 'rough';
    else grid[x][z] = 'out';
  }
}

function createTerrainMeshes(grid) {
  const planeGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
  for (let x = 0; x < GRID_SIZE; x += 1) {
    for (let z = 0; z < GRID_SIZE; z += 1) {
      const type = grid[x][z];
      const mat = new THREE.MeshStandardMaterial({ color: TERRAIN[type].color, side: THREE.DoubleSide });
      const tile = new THREE.Mesh(planeGeometry, mat);
      tile.rotation.x = -Math.PI / 2;
      const height = terrainHeightMap[x][z];
      tile.position.set((x - GRID_SIZE / 2) * TILE_SIZE + TILE_SIZE / 2, height, (z - GRID_SIZE / 2) * TILE_SIZE + TILE_SIZE / 2);
      scene.add(tile);
      terrainMeshes.push(tile);
      if (type === 'sand') tile.position.y = height + 0.05;
      if (type === 'water') tile.position.y = height - 0.1;
    }
  }
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
  ballPosition.set(pos.x, 1.2, pos.z);
  ballMesh.position.copy(ballPosition);
  velocity = 0;
  inMotion = false;
  shotCount = 0;
}

function placeHole() {
  const pos = cellToWorld(holeCell);
  holeMesh.position.set(pos.x, 0.5, pos.z);
}

function createAimingLine() {
  if (aimingLine) scene.remove(aimingLine);
  
  const points = [];
  points.push(ballPosition.clone());
  const previewDistance = currentClub.factor * 35;
  const previewEnd = new THREE.Vector3().copy(ballPosition).addScaledVector(targetVector, previewDistance);
  points.push(previewEnd);
  
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0xffaa00, linewidth: 2 });
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
});

hitButton.addEventListener('click', hitBall);
nextHoleButton.addEventListener('click', nextHole);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

init();
