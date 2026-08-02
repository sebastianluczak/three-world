import {
	BoxGeometry,
	CircleGeometry,
	Mesh,
	MeshBasicMaterial,
	OrthographicCamera,
	PerspectiveCamera,
	Scene,
	SphereGeometry,
	WebGLRenderer,
} from "three";
import { OrbitControls, TransformControls } from "three/examples/jsm/Addons.js";

let cameraPersp: PerspectiveCamera,
	cameraOrtho: OrthographicCamera,
	currentCamera: PerspectiveCamera | OrthographicCamera;
let scene: Scene,
	renderer: WebGLRenderer,
	control: TransformControls,
	orbit: OrbitControls;

// When nothing is dragged for some time, start animation
// TODO: this is the code
// function animate( time: number ) {
//   cube.rotation.y = time / 41000;
//   renderer.render( scene, camera );
// }

// The moment I'm INSIDE the cube, need to be somehow checked and I want to switch
// the view to another camera, and then when I exit the cube, switch back to the original camera. 
// TODO: pure idea

init();
render();

function init() {
	scene = new Scene();
	const aspect = window.innerWidth / window.innerHeight;
	const frustumSize = 5;

	cameraPersp = new PerspectiveCamera(
		90,
		window.innerWidth / window.innerHeight,
		0.1,
		1000,
	);
	cameraOrtho = new OrthographicCamera(
		-frustumSize * aspect,
		frustumSize * aspect,
		frustumSize,
		-frustumSize,
		0.1,
		100,
	);
	currentCamera = cameraPersp;

	renderer = new WebGLRenderer();
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);

	const geometry = new SphereGeometry(1, 32);
	const material = new MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
	const cube = new Mesh(geometry, material);
	scene.add(cube);

	orbit = new OrbitControls(currentCamera, renderer.domElement);
	orbit.update();
	orbit.addEventListener("change", render);

	control = new TransformControls(currentCamera, renderer.domElement);
	control.addEventListener("change", render);
	control.addEventListener("dragging-changed", (event) => {
		orbit.enabled = !event.value;
	});

	currentCamera.position.z = 2;
}

function render() {
	renderer.render(scene, currentCamera);
}
