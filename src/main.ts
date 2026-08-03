import {
  DirectionalLight,
	Mesh,
	MeshBasicMaterial,
	OrthographicCamera,
	Scene,
	SphereGeometry,
	WebGLRenderer,
	Vector3,
	BufferGeometry,
	BufferAttribute,
	Points,
	PointsMaterial,
  MeshDepthMaterial,
  MeshNormalMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  TextureLoader,
  Texture,
  Texture,
} from "three";
import { OrbitControls, TransformControls } from "three/examples/jsm/Addons.js";
import * as CANNON from 'cannon-es';
import { BumpMapNode } from "three/webgpu";

let camera: OrthographicCamera,
  scene: Scene,
	renderer: WebGLRenderer,
	control: TransformControls,
	orbit: OrbitControls,
  worldSphere: Mesh;

// Physics world
let world: CANNON.World;
let sphereBody: CANNON.Body;
let fragmentBodies: CANNON.Body[] = [];
let fragmentMeshes: Mesh[] = [];

// Particles
let particles: Points | null = null;

// When nothing is dragged for some time, start animation
function animate( time: number ) {
  // The main spehere is rotating.
  worldSphere.rotation.y = time / 3000;
  
  // The spheres created by big bang are also rotating.
  for (let i = 0; i < fragmentBodies.length; i++) {
    fragmentBodies[i]!.angularVelocity.set(0.1, 0.1, 0.0);
  }
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
  
  renderer.render( scene, camera );
  requestAnimationFrame( animate );
}

init();
animate( 0 );


function lookAtPlanetAtIndex(index: number) {
  if (isNaN(index) || index < 0 || index >= fragmentBodies.length) {
    console.log(`Invalid index: ${index}. Must be between 0 and ${Math.abs(fragmentBodies.length - 1)}`);
    return;
  }

  const childBody = fragmentBodies[index];
  const childMesh = fragmentMeshes[index];
  if (childMesh && childBody) {
    // Convert CANNON.Vec3 to THREE.Vector3 for camera/controls operations
    const targetPosition = new Vector3(childBody.position.x, childBody.position.y, childBody.position.z);
    console.log(`Looking at planet index: ${index} at position: (${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)})`);

    // Compute a safe direction from current camera position to the target; if camera is exactly at target, use a default direction
    let direction = camera.position.clone().sub(targetPosition);
    if (direction.length() < 1e-3) {
      direction = new Vector3(1, 1, 1);
    }
    direction.normalize();

    // Desired distance from the target; ensure it's larger than fragment radius
    const desiredDistance = 4.0;
    camera.position.copy(targetPosition).add(direction.multiplyScalar(desiredDistance));

    // Make the camera look at the planet
    camera.lookAt(targetPosition);

    // Tell OrbitControls to orbit around the planet
    orbit.target.copy(targetPosition);
    orbit.update();

    console.log(`Camera now looking at planet index: ${index}`);
  } else {
    console.log(`No planet found at index: ${index}`);
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
    const geometry = new SphereGeometry(0.3, 10, 10);


    const worldImage = new TextureLoader().load('textures/world.jpg');
    const texture = new Texture(worldImage);
    const material = new MeshLambertMaterial({
      // color: 0x3498db,      // Base blue color
      map: texture
    });
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

  // const backgroundGeometry = new SphereGeometry(190, 1, 1);
  // const backgroundMaterial = new MeshBasicMaterial({ color: 0x220044, side: BackSide });
  // const backgroundMesh = new Mesh(backgroundGeometry, backgroundMaterial);
  // scene.add(backgroundMesh);
  
  const starGeometry = new SphereGeometry(0.02, 8, 8);
  const starMaterial = new MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 1000; i++) {
    const star = new Mesh(starGeometry, starMaterial);
    star.position.set(
      (Math.random() - 0.5) * 200,
      (Math.random() - 0.5) * 200,
      (Math.random() - 0.5) * 200
    );

    // Each star is a light source as well, spherical light with low intensity
    // const starLight = new DirectionalLight(0xffffff, 1);
    // starLight.position.copy(star.position);
    // scene.add(starLight);

    scene.add(star);
  }

//   const loader = new GLTFLoader();
//   loader.load( 'ClearCoatCarPaint.glb', function ( gltf ) {
//   gltf.scene.translateY(-0.5);
//   scene.add( gltf.scene );

// }, undefined, function ( error ) {

//   console.error( error );

// } );


	// Put the camera further out and set a reasonable orthographic zoom
	camera.position.set(5, 3, 5);
	camera.zoom = 1.0;
	camera.updateProjectionMatrix();

	// OrbitControls tuning for smoother, stable behavior
	orbit = new OrbitControls(camera, renderer.domElement);
	orbit.enableDamping = true;
	orbit.dampingFactor = 0.06;
	orbit.screenSpacePanning = false; // pan in screen-space instead of world-space
	orbit.minPolarAngle = 0.1; // prevent going directly above/below
	orbit.maxPolarAngle = Math.PI - 0.1;
	// With an orthographic camera, clamp zoom instead of distance
	(orbit as any).minZoom = 0.5;
	(orbit as any).maxZoom = 5;
	orbit.target.set(0, 0, 0);
	orbit.update();
	orbit.addEventListener("change", render);

	control = new TransformControls(camera, renderer.domElement);
	control.addEventListener("change", render);
	control.addEventListener("dragging-changed", (event) => {
		orbit.enabled = !event.value;
	});

	let currentFragmentIndex = 0;


  // if not exploded, explode at start.
  if (fragmentBodies.length === 0) {
    console.log("No fragments yet, exploding sphere first.");
    explodeSphere();
  } else {
    console.log("Fragments already exist, looking at current fragment.");
  }
  
	// E for explosion; Q/W to navigate fragments
	window.addEventListener("keydown", (event) => {
	  if (event.code === "KeyE") {
	    event.preventDefault();
	    explodeSphere();
	  }
	  if (event.key === "q") {
	    console.log("Looking at PREVIOUS fragment");
	    event.preventDefault();
	    lookAtPlanetAtIndex(Math.abs((currentFragmentIndex - 1) % fragmentMeshes.length));
	    // shift the index internally
	    currentFragmentIndex = Math.abs((currentFragmentIndex - 1) % fragmentMeshes.length);
	  }
	  if (event.key === "w") {
	    console.log("Looking at NEXT fragment");
	    event.preventDefault();
	    lookAtPlanetAtIndex(Math.abs(currentFragmentIndex + 1) % fragmentMeshes.length);
	    // shift the index internally
	    currentFragmentIndex = Math.abs((currentFragmentIndex + 1) % fragmentMeshes.length);
	  }
	});
}

function render() {
	renderer.render(scene, camera);
}
