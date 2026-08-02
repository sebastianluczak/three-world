import {
  BackSide,
  DirectionalLight,
	Mesh,
	MeshBasicMaterial,
	OrthographicCamera,
	Scene,
	SphereGeometry,
	WebGLRenderer,
	Vector3,
	Raycaster,
	BufferGeometry,
	BufferAttribute,
	Points,
	PointsMaterial,
} from "three";
import { OrbitControls, TransformControls } from "three/examples/jsm/Addons.js";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as CANNON from 'cannon-es';

let camera: OrthographicCamera,
  scene: Scene,
	renderer: WebGLRenderer,
	control: TransformControls,
	orbit: OrbitControls,
  worldSphere: Mesh;

// Satellite mode variables
let satelliteMode = false;
let satellitePointLongitude = 0;
let satellitePointLatitude = 0;

// Physics world
let world: CANNON.World;
let sphereBody: CANNON.Body;
let fragmentBodies: CANNON.Body[] = [];
let fragmentMeshes: Mesh[] = [];

// Particles
let particles: Points | null = null;

// When nothing is dragged for some time, start animation
function animate( time: number ) {
  worldSphere.rotation.y = time / 41000;
  
  // Update physics
  world.step(1 / 60);
  
  // Update fragment meshes from physics bodies
  for (let i = 0; i < fragmentMeshes.length; i++) {
    const mesh = fragmentMeshes[i]!;
    const body = fragmentBodies[i]!;
    mesh.position.copy(body.position as any);
    mesh.quaternion.copy(body.quaternion as any);
  }
  
  // Update particles
  if (particles) {
    const posAttr = particles.geometry.attributes.position;
    if (posAttr) {
      const positions = posAttr.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i]! -= Math.random() * 0.02;
        positions[i + 1]! -= 0.01;
        positions[i + 2]! -= Math.random() * 0.02;
      }
      posAttr.needsUpdate = true;
    }
  }
  
  if ( satelliteMode ) {
    updateSatelliteCamera();
  }
  
  renderer.render( scene, camera );
  requestAnimationFrame( animate );
}

init();
animate( 0 );

function updateSatelliteCamera() {
  const cameraDistance = 3;
  
  const sphereRotationY = worldSphere.rotation.y;
  
  const effectiveLatitude = satellitePointLatitude;
  const effectiveLongitude = satellitePointLongitude + sphereRotationY;
  
  const x = Math.cos(effectiveLatitude) * Math.sin(effectiveLongitude);
  const y = Math.sin(effectiveLatitude);
  const z = Math.cos(effectiveLatitude) * Math.cos(effectiveLongitude);
  
  camera.position.set(
    x * cameraDistance,
    y * cameraDistance,
    z * cameraDistance
  );
  
  const targetPoint = new Vector3(x, y, z);
  camera.lookAt(targetPoint);
}

function toggleSatelliteMode() {
  satelliteMode = !satelliteMode;
  
  if ( satelliteMode ) {
    const cameraDirection = new Vector3();
    camera.getWorldDirection(cameraDirection);
    
    const raycaster = new Raycaster(camera.position, cameraDirection);
    const intersects = raycaster.intersectObject(worldSphere);
    
    if ( intersects.length > 0 ) {
      const hitPoint = intersects[0]!.point;
      const localPoint = hitPoint.clone();
      
      satellitePointLatitude = Math.asin(localPoint.y);
      satellitePointLongitude = Math.atan2(localPoint.x, localPoint.z);
      
      console.log(`Satellite locked to point: lat=${(satellitePointLatitude * 180 / Math.PI).toFixed(1)}°, lon=${(satellitePointLongitude * 180 / Math.PI).toFixed(1)}°`);
    }
    
    orbit.enabled = false;
    control.enabled = false;
    
    console.log("Satellite mode ON");
  } else {
    orbit.enabled = true;
    control.enabled = true;
    
    console.log("Satellite mode OFF");
  }
}

function explodeSphere() {
  if (fragmentMeshes.length > 0) {
    console.log("Sphere already exploded!");
    return;
  }
  
  console.log("💥 EXPLOSION!");
  
  // Remove the main sphere from scene
  scene.remove(worldSphere);
  
  // Create fragments
  const fragmentCount = 12;
  const explosionForce = 30;
  
  for (let i = 0; i < fragmentCount; i++) {
    // Create fragment mesh
    const geometry = new SphereGeometry(0.3, 8, 8);
    const material = new MeshBasicMaterial({ color: Math.random() * 0xffffff, wireframe: true });
    const fragment = new Mesh(geometry, material);
    
    // Position around sphere center
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const radius = 0.8;
    
    fragment.position.set(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi)
    );
    
    scene.add(fragment);
    fragmentMeshes.push(fragment);
    
    // Create physics body
    const shape = new CANNON.Sphere(0.3);
    const body = new CANNON.Body({
      mass: 1,
      shape: shape,
      linearDamping: 0.3,
      angularDamping: 0.3,
    });
    
    body.position.copy(fragment.position as any);
    world.addBody(body);
    fragmentBodies.push(body);
    
    // Apply explosion force
    const forceDirection = new CANNON.Vec3(
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi)
    );
    forceDirection.normalize();
    
    body.applyImpulse(
      new CANNON.Vec3(
        forceDirection.x * explosionForce,
        forceDirection.y * explosionForce,
        forceDirection.z * explosionForce
      ),
      body.position
    );
  }
  
  // Create particles
  createExplosionParticles();
}

function createExplosionParticles() {
  const particleCount = 1000;
  const positions = new Float32Array(particleCount * 3);
  
  for (let i = 0; i < particleCount * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 2;
    positions[i + 1] = (Math.random() - 0.5) * 2;
    positions[i + 2] = (Math.random() - 0.5) * 2;
  }
  
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  
  const material = new PointsMaterial({
    color: 0xffaa00,
    size: 0.05,
  });
  
  particles = new Points(geometry, material);
  scene.add(particles);
}

function init() {
	scene = new Scene();
	const aspect = window.innerWidth / window.innerHeight;
	const frustumSize = 10;

	camera = new OrthographicCamera(
		-frustumSize * aspect,
		frustumSize * aspect,
		frustumSize,
		-frustumSize,
		0.01,
		200,
	);;

	renderer = new WebGLRenderer();
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);

	const geometry = new SphereGeometry(1, 32);
	const material = new MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
	worldSphere = new Mesh(geometry, material);
	scene.add(worldSphere);

  // Physics world setup
  world = new CANNON.World();
  world.gravity.set(0, 0, 0);
  world.defaultContactMaterial.friction = 0.3;
  
  // Create physics body for sphere
  const sphereShape = new CANNON.Sphere(1);
  sphereBody = new CANNON.Body({
    mass: 0, // Static
    shape: sphereShape,
  });
  world.addBody(sphereBody);

  const light = new DirectionalLight(0xffffff, 1);
  light.position.set(5, 5, 5);
  scene.add(light);

  const light2 = new DirectionalLight(0xffffff, 0.5);
  light2.position.set(-40, -5, -5);
  scene.add(light2);

  const backgroundGeometry = new SphereGeometry(100, 64, 64);
  const backgroundMaterial = new MeshBasicMaterial({ color: 0x000044, side: BackSide });
  const backgroundMesh = new Mesh(backgroundGeometry, backgroundMaterial);
  scene.add(backgroundMesh);
  
  const starGeometry = new SphereGeometry(0.02, 8, 8);
  const starMaterial = new MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 1000; i++) {
    const star = new Mesh(starGeometry, starMaterial);
    star.position.set(
      (Math.random() - 0.5) * 200,
      (Math.random() - 0.5) * 200,
      (Math.random() - 0.5) * 200
    );
    scene.add(star);
  }

  const loader = new GLTFLoader();
  loader.load( 'ClearCoatCarPaint.glb', function ( gltf ) {
  gltf.scene.translateY(-0.5);
  scene.add( gltf.scene );

}, undefined, function ( error ) {

  console.error( error );

} );

	orbit = new OrbitControls(camera, renderer.domElement);
	orbit.update();
	orbit.addEventListener("change", render);

	control = new TransformControls(camera, renderer.domElement);
	control.addEventListener("change", render);
	control.addEventListener("dragging-changed", (event) => {
		orbit.enabled = !event.value;
	});

	camera.position.z = 2;

	// SPACE BAR for satellite mode, E for explosion
	window.addEventListener("keydown", (event) => {
		if (event.code === "Space") {
			event.preventDefault();
			toggleSatelliteMode();
		}
    if (event.code === "KeyE") {
      event.preventDefault();
      explodeSphere();
    }
	});
}

function render() {
	renderer.render(scene, camera);
}
