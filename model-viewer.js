import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';

export class ModelViewer {
    constructor(containerId) {
        this.containerId = containerId; 
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xd3d3d3);

        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.z = 5;

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.5;

        document.getElementById(containerId).appendChild(this.renderer.domElement);

        this.setupLights();

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        this.moveSpeed = 5;
        this.keys = {
            ArrowLeft: false,
            ArrowRight: false,
            ArrowUp: false,
            ArrowDown: false
        };

        this.setupEventListeners();
        this.populateModelDropdown();
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, .5);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
        mainLight.position.set(10, 10, 10);
        this.scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(0xffffff, .5);
        fillLight.position.set(-10, 5, -10);
        this.scene.add(fillLight);

        const topLight = new THREE.DirectionalLight(0xffffff, 0.5);
        topLight.position.set(0, 10, 0);
        this.scene.add(topLight);

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, .5);
        this.scene.add(hemiLight);
    }

    setupEventListeners() {
        document.addEventListener('keydown', (event) => {
            if (this.keys.hasOwnProperty(event.code)) {
                this.keys[event.code] = true;
            }
        });

        document.addEventListener('keyup', (event) => {
            if (this.keys.hasOwnProperty(event.code)) {
                this.keys[event.code] = false;
            }
        });

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    async loadModel(objPath, mtlPath) {
        this.disposeModel();
    
        return new Promise((resolve, reject) => {
            const mtlLoader = new MTLLoader();
    
            mtlLoader.load(
                mtlPath,
                (materials) => {
                    materials.preload();
                    const objLoader = new OBJLoader();
                    objLoader.setMaterials(materials);
    
                    objLoader.load(
                        objPath,
                        (object) => {
                            const box = new THREE.Box3().setFromObject(object);
                            const center = box.getCenter(new THREE.Vector3());
                            object.position.sub(center);
    
                            object.rotation.y = Math.PI; 
    
                            object.traverse((child) => {
                                if (child.isMesh) {
                                    child.material.flatShading = false; 
                                    child.material.needsUpdate = true;
                                }
                            });
    
                            this.currentModel = object;
                            this.scene.add(object);
    
                            const size = box.getSize(new THREE.Vector3());
                            const maxDim = Math.max(size.x, size.y, size.z);
                            this.camera.position.z = maxDim * 2;
    
                            this.controls.target.set(0, 0, 0);
                            this.controls.update();
    
                            resolve(object);
                        },
                        (xhr) => {
                        },
                        (error) => {
                            console.error('Error loading OBJ:', error);
                            reject(error);
                        }
                    );
                },
                (xhr) => {
                },
                (error) => {
                    console.error('Error loading MTL:', error);
                    reject(error);
                }
            );
        });
    }

    disposeModel() {
        if (this.currentModel) {
            this.scene.remove(this.currentModel);

            this.currentModel = null;
        }
    }

    loadModelFromDropdown() {
        const select = document.getElementById('modelSelect');
        const selectedValue = select.value;
        const [objPath, mtlPath] = selectedValue.split(',');

        this.loadModel(objPath, mtlPath)
            .then(() => {
            })
            .catch(error => {
                console.error("Error loading model:", error);
            });
    }

    updateCamera() {
        if (Object.values(this.keys).some(key => key)) {
            const forward = new THREE.Vector3();
            this.camera.getWorldDirection(forward);
            const right = new THREE.Vector3();
            right.crossVectors(forward, this.camera.up);

            if (this.keys.ArrowUp) {
                this.camera.position.addScaledVector(forward, this.moveSpeed);
                this.controls.target.addScaledVector(forward, this.moveSpeed);
            }
            if (this.keys.ArrowDown) {
                this.camera.position.addScaledVector(forward, -this.moveSpeed);
                this.controls.target.addScaledVector(forward, -this.moveSpeed);
            }
            if (this.keys.ArrowLeft) {
                this.camera.position.addScaledVector(right, -this.moveSpeed);
                this.controls.target.addScaledVector(right, -this.moveSpeed);
            }
            if (this.keys.ArrowRight) {
                this.camera.position.addScaledVector(right, this.moveSpeed);
                this.controls.target.addScaledVector(right, this.moveSpeed);
            }

            this.controls.update();
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.updateCamera();
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    async populateModelDropdown() {
        try {
            const modelFiles = await this.getModelList();
            const selectElement = document.getElementById('modelSelect');

            modelFiles.forEach(model => {
                const option = document.createElement('option');
                option.value = `models/${model.obj},models/${model.mtl}`;
                option.textContent = model.name; 
                selectElement.appendChild(option);
            });
            this.initSelect2();

        } catch (error) {
            console.error("Error populating dropdown:", error);
        } finally {
            document.getElementById('loadingMessage').style.display = 'none';
            document.getElementById('modelSelect').style.display = 'inline-block';  
            document.getElementById('loadButton').style.display = 'inline-block'; 
        }
    }

    async getModelList() {
        try {
            const modelsDir = 'models/';  
            const response = await fetch(modelsDir, {mode: 'cors'});

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const parser = new DOMParser();
            const htmlText = await response.text();
            const html = parser.parseFromString(htmlText, 'text/html');

            const modelFiles = [];
            const links = html.querySelectorAll('a'); 

            for (let i = 0; i < links.length; i++) {
                const filename = links[i].href.split('/').pop();
                const fileExtension = filename.split('.').pop();

                if (fileExtension === 'obj') {
                    const baseName = filename.replace('.obj', '');
                    const mtlFile = `${baseName}.mtl`;

                    const mtlExists = Array.from(links).some(link => link.href.endsWith(mtlFile));

                    if (mtlExists) {
                        modelFiles.push({
                            name: baseName,
                            obj: filename,
                            mtl: mtlFile
                        });
                    } else {
                        console.warn(`MTL file not found for ${filename}`);
                    }
                }
            }

            return modelFiles;

        } catch (error) {
            console.error("Could not fetch model list:", error);
            return []; 
        }
    }

    initSelect2() {
        this.loadSelect2().then(() => {
            $(document).ready(function() {
                $('#modelSelect').select2({
                    placeholder: 'Search for a model',
                    allowClear: true
                });
            });
        });
    }

    loadSelect2() {
        return new Promise((resolve, reject) => {
            if (typeof $.fn.select2 === 'undefined') {
                const css = document.createElement('link');
                css.rel = 'stylesheet';
                css.href = 'https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/css/select2.min.css';
                document.head.appendChild(css);

                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/js/select2.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.body.appendChild(script);
            } else {
                resolve();
            }
        });
    }
}