import { state } from './state.js'

export const activeAnimations = []
export const pendingTimeouts = []
export const activeElements = []
export const hiddenElements = []

export function scheduleAnimation (callback, delay) {
  const timeoutId = setTimeout(() => {
    const idx = pendingTimeouts.indexOf(timeoutId)
    if (idx !== -1) pendingTimeouts.splice(idx, 1)
    callback()
  }, delay)
  pendingTimeouts.push(timeoutId)
  return timeoutId
}

export function stopAllAnimations () {
  activeAnimations.forEach(handle => cancelAnimationFrame(handle.id))
  activeAnimations.length = 0

  pendingTimeouts.forEach(id => clearTimeout(id))
  pendingTimeouts.length = 0

  activeElements.forEach(el => {
    if (el && el.parentNode) el.parentNode.removeChild(el)
  })
  activeElements.length = 0

  hiddenElements.forEach(el => {
    if (el) el.style.visibility = 'visible'
  })
  hiddenElements.length = 0
}

export function startPhysicsAnimation (physics, onComplete) {
  physics.startTime = performance.now()
  const handle = { id: null }

  function animate (timestamp) {
    if (state.isPaused) return

    const elapsed = (timestamp - physics.startTime) / 1000

    if (elapsed >= physics.duration / 1000) {
      const index = activeAnimations.indexOf(handle)
      if (index !== -1) activeAnimations.splice(index, 1)
      const elIndex = activeElements.indexOf(physics.element)
      if (elIndex !== -1) activeElements.splice(elIndex, 1)
      onComplete()
      return
    }

    const vx = physics.initialSpeed * Math.cos(physics.angle)
    const vy = -physics.initialSpeed * Math.sin(physics.angle)

    physics.x = vx * elapsed
    physics.y = vy * elapsed + 0.5 * physics.gravity * elapsed * elapsed
    physics.rotation = physics.rotationSpeed * elapsed

    const normalizedTime = elapsed / (physics.duration / 1000)
    physics.opacity = normalizedTime < 0.7 ? 1 : 1 - ((normalizedTime - 0.7) / 0.3)
    const scale = 1 + normalizedTime * ((physics.scale ?? 1) - 1)

    physics.element.style.transform = `translate(${physics.x}px, ${physics.y}px) rotate(${physics.rotation}deg) scale(${scale})`
    physics.element.style.opacity = physics.opacity

    handle.id = requestAnimationFrame(animate)
  }

  if (physics.element && !activeElements.includes(physics.element)) {
    activeElements.push(physics.element)
  }

  handle.id = requestAnimationFrame(animate)
  activeAnimations.push(handle)
}

export function createExplosionPhysics (element = null) {
  return {
    angle: (45 + Math.random() * 90) * Math.PI / 180,
    initialSpeed: 200 + Math.random() * 100,
    rotationSpeed: -360 + Math.random() * 720,
    gravity: 980,
    duration: 400 + Math.random() * 400,
    startTime: null,
    x: 0,
    y: 0,
    rotation: 0,
    opacity: 1,
    element
  }
}

export function explodeCellsGrid (activeDomCells, onComplete) {
  if (activeDomCells.length === 0) {
    if (onComplete) onComplete()
    return
  }

  let completedAnimations = 0
  const totalAnimations = activeDomCells.length

  const MEAN_DELAY = 1000
  const STD_DEVIATION = 500

  function getNormalRandom (mean, stdDev) {
    const u1 = Math.random()
    const u2 = Math.random()
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
    return mean + z0 * stdDev
  }

  activeDomCells.forEach(element => {
    const delay = Math.max(0, Math.min(2000, getNormalRandom(MEAN_DELAY, STD_DEVIATION)))

    scheduleAnimation(() => {
      const physics = createExplosionPhysics()

      const cellRect = element.getBoundingClientRect()
      const cellStyle = window.getComputedStyle(element)
      element.style.visibility = 'hidden'
      if (!hiddenElements.includes(element)) {
        hiddenElements.push(element)
      }

      const clone = document.createElement('div')
      clone.className = element.className
      clone.innerHTML = element.innerHTML
      Object.assign(clone.style, {
        position: 'fixed',
        left: `${cellRect.left}px`,
        top: `${cellRect.top}px`,
        width: `${cellRect.width}px`,
        height: `${cellRect.height}px`,
        zIndex: '999',
        borderRadius: cellStyle.borderRadius,
        backgroundColor: cellStyle.backgroundColor
      })

      document.body.appendChild(clone)
      physics.element = clone

      startPhysicsAnimation(physics, () => {
        if (document.body.contains(clone)) document.body.removeChild(clone)
        const hIdx = hiddenElements.indexOf(element)
        if (hIdx !== -1) hiddenElements.splice(hIdx, 1)
        completedAnimations++
        if (completedAnimations === totalAnimations) {
          activeDomCells.forEach(cell => { cell.style.visibility = 'visible' })
          if (onComplete) onComplete()
        }
      })
    }, delay)
  })
}
