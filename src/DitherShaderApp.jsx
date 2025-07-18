
import React, { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

export default function DitherShaderApp() {
  const mountRef = useRef(null)
  const [fileInput, setFileInput] = useState(null)

  useEffect(() => {
    const width = mountRef.current.clientWidth
    const height = mountRef.current.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a1a)

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.set(0, 0, 5)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    mountRef.current.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    scene.add(new THREE.AmbientLight(0xffffff, 0.5))

    const light = new THREE.DirectionalLight(0xffffff, 1)
    light.position.set(2, 2, 2)
    scene.add(light)

    let model = null
    const loader = new OBJLoader()

    const fallbackMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true })

    const shaderMaterial = new THREE.ShaderMaterial({
      vertexShader: \`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      \`,
      fragmentShader: \`
        varying vec2 vUv;
        void main() {
          float gray = dot(vec3(1.0), vec3(0.299, 0.587, 0.114));
          int x = int(mod(gl_FragCoord.x, 8.0));
          int y = int(mod(gl_FragCoord.y, 8.0));
          float threshold = mod(float(x * y), 64.0) / 64.0;
          float color = step(threshold, gray);
          gl_FragColor = vec4(vec3(color), 1.0);
        }
      \`
    })

    const handleOBJ = (file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const obj = loader.parse(e.target.result)
          console.log('%c✅ Model loaded from file', 'color: green', obj)

          obj.traverse((child) => {
            if (child.isMesh) {
              // Apply shader, fallback to wireframe
              child.material = shaderMaterial || fallbackMaterial
              child.material.needsUpdate = true
            }
          })

          // Center & scale model
          const box = new THREE.Box3().setFromObject(obj)
          const size = box.getSize(new THREE.Vector3())
          const center = box.getCenter(new THREE.Vector3())

          const maxDim = Math.max(size.x, size.y, size.z)
          const scale = 2.0 / maxDim
          obj.scale.setScalar(scale)
          obj.position.sub(center.multiplyScalar(scale))

          if (model) scene.remove(model)
          model = obj
          scene.add(obj)
        } catch (err) {
          console.error('%c❌ Failed to load OBJ:', 'color: red', err)
        }
      }
      reader.readAsText(file)
    }

    const animate = () => {
      requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      mountRef.current.removeChild(renderer.domElement)
    }
  }, [])

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setFileInput(e.target.files[0])
      const reader = new FileReader()
      reader.onload = () => {
        const event = new CustomEvent('loadOBJ', { detail: e.target.files[0] })
        window.dispatchEvent(event)
      }
      reader.readAsText(e.target.files[0])
    }
  }

  useEffect(() => {
    const onLoadOBJ = (e) => {
      if (e.detail) {
        const file = e.detail
        const reader = new FileReader()
        reader.onload = (event) => {
          const objText = event.target.result
          const loader = new OBJLoader()
          try {
            const obj = loader.parse(objText)
            console.log('%c✅ Parsed OBJ successfully', 'color: lime')
          } catch (e) {
            console.error('%c❌ Parse error', 'color: red', e)
          }
        }
        reader.readAsText(file)
      }
    }
    window.addEventListener('loadOBJ', onLoadOBJ)
    return () => window.removeEventListener('loadOBJ', onLoadOBJ)
  }, [])

  return (
    <div style={{ textAlign: 'center' }}>
      <h2 style={{ color: '#fff' }}>Dither Shader OBJ Viewer (With Fallback)</h2>
      <input type="file" accept=".obj" onChange={handleFileChange} />
      <div ref={mountRef} style={{ width: '600px', height: '600px', margin: '20px auto' }}></div>
    </div>
  )
}
