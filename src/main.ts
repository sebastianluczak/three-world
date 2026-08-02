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
} from "three";
import { OrbitControls, TransformControls } from "three/examples/jsm/Addons.js";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// let cameraPersp: PerspectiveCamera,
let camera: OrthographicCamera,
  scene: Scene,
	renderer: WebGLRenderer,
	control: TransformControls,
	orbit: OrbitControls,
  worldSphere: Mesh;

// Satellite mode variables
let satelliteMode = false;
let satellitePointLongitude = 0; // Initial point on sphere (in radians)
let satellitePointLatitude = 0;

// When nothing is dragged for some time, start animation
function animate( time: number ) {
  worldSphere.rotation.y = time / 41000;
  
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
  
  // Sphere's current rotation
  const sphereRotationY = worldSphere.rotation.y;
  
  // Point on sphere in local coordinates (latitude/longitude style)
  const effectiveLatitude = satellitePointLatitude;
  const effectiveLongitude = satellitePointLongitude + sphereRotationY;
  
  // Convert spherical to Cartesian coordinates
  const x = Math.cos(effectiveLatitude) * Math.sin(effectiveLongitude);
  const y = Math.sin(effectiveLatitude);
  const z = Math.cos(effectiveLatitude) * Math.cos(effectiveLongitude);
  
  // Position camera above the point on sphere surface
  camera.position.set(
    x * cameraDistance,
    y * cameraDistance,
    z * cameraDistance
  );
  
  // Look at the point on sphere surface
  const targetPoint = new Vector3(x, y, z);
  camera.lookAt(targetPoint);
}

function toggleSatelliteMode() {
  satelliteMode = !satelliteMode;
  
  if ( satelliteMode ) {
    // Find what point on sphere we're currently looking at
    const cameraDirection = new Vector3();
    camera.getWorldDirection(cameraDirection);
    
    // Cast a ray from camera to find intersection with sphere
    const raycaster = new Raycaster(camera.position, cameraDirection);
    const intersects = raycaster.intersectObject(worldSphere);
    
    if ( intersects.length > 0 ) {
      // Get the intersection point
      const hitPoint = intersects[0].point;
      
      // Convert world position to sphere local coordinates
      const localPoint = hitPoint.clone();
      
      // Calculate latitude (angle from equator)
      satellitePointLatitude = Math.asin(localPoint.y);
      
      // Calculate longitude (angle around Y axis)
      satellitePointLongitude = Math.atan2(localPoint.x, localPoint.z);
      
      console.log(`Satellite locked to point: lat=${(satellitePointLatitude * 180 / Math.PI).toFixed(1)}°, lon=${(satellitePointLongitude * 180 / Math.PI).toFixed(1)}°`);
    }
    
    // Disable orbit controls in satellite mode
    orbit.enabled = false;
    control.enabled = false;
    
    console.log("Satellite mode ON - camera locked to sphere point");
  } else {
    // Re-enable orbit controls
    orbit.enabled = true;
    control.enabled = true;
    
    console.log("Satellite mode OFF");
  }
}

function init() {
	scene = new Scene();
	const aspect = window.innerWidth / window.innerHeight;
	const frustumSize = 10;

	// cameraPersp = new PerspectiveCamera(
	// 	90,
	// 	window.innerWidth / window.innerHeight,
	// 	0.1,
	// 	1000,
	// );
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

  // damn, some light source would be nice.
  const light = new DirectionalLight(0xffffff, 1);
  light.position.set(5, 5, 5);
  scene.add(light);

  // second light from up, to make the shadows less harsh
  const light2 = new DirectionalLight(0xffffff, 0.5);
  light2.position.set(-40, -5, -5);
  scene.add(light2);

  // Now, some background with stars would be nice.
  const backgroundGeometry = new SphereGeometry(100, 64, 64);
  const backgroundMaterial = new MeshBasicMaterial({ color: 0x000044, side: BackSide });
  const backgroundMesh = new Mesh(backgroundGeometry, backgroundMaterial);
  scene.add(backgroundMesh);
  // add stars to the background
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

  // lets have fun with objects
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

	// Add SPACE BAR listener for satellite mode toggle
	window.addEventListener("keydown", (event) => {
		if (event.code === "Space") {
			event.preventDefault();
			toggleSatelliteMode();
		}
	});
}

function render(time?: number) {
	renderer.render(scene, camera);
}
