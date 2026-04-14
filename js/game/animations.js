import { state } from './state.js';

export const activeAnimations = [];

export function startPhysicsAnimation(physics, onComplete) {
    physics.startTime = performance.now();
    let animationId = null;
    
    function animate(timestamp) {
        if (state.isPaused) return;
        
        const elapsed = (timestamp - physics.startTime) / 1000;
        
        if (elapsed >= physics.duration / 1000) {
            const index = activeAnimations.indexOf(animationId);
            if (index !== -1) activeAnimations.splice(index, 1);
            onComplete();
            return;
        }
        
        const vx = physics.initialSpeed * Math.cos(physics.angle);
        const vy = -physics.initialSpeed * Math.sin(physics.angle);
        
        physics.x = vx * elapsed;
        physics.y = vy * elapsed + 0.5 * physics.gravity * elapsed * elapsed;
        physics.rotation = physics.rotationSpeed * elapsed;
        
        const normalizedTime = elapsed / (physics.duration / 1000);
        physics.opacity = normalizedTime < 0.7 ? 1 : 1 - ((normalizedTime - 0.7) / 0.3);
        const scale = 1 + normalizedTime * ((physics.scale ?? 1) - 1);
        
        physics.element.style.transform = `translate(${physics.x}px, ${physics.y}px) rotate(${physics.rotation}deg) scale(${scale})`;
        physics.element.style.opacity = physics.opacity;
        
        animationId = requestAnimationFrame(animate);
    }
    
    animationId = requestAnimationFrame(animate);
    activeAnimations.push(animationId);
}

export function explodeCellsGrid(activeDomCells, onComplete) {
    if (activeDomCells.length === 0) {
        if (onComplete) onComplete();
        return;
    }
    
    let completedAnimations = 0;
    const totalAnimations = activeDomCells.length;
    
    const MEAN_DELAY = 1000;
    const STD_DEVIATION = 500;
    
    function getNormalRandom(mean, stdDev) {
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        return mean + z0 * stdDev;
    }
    
    activeDomCells.forEach(element => {
        const delay = Math.max(0, Math.min(2000, getNormalRandom(MEAN_DELAY, STD_DEVIATION)));
        
        setTimeout(() => {
            const physics = {
                angle: (45 + Math.random() * 90) * Math.PI / 180,
                initialSpeed: 200 + Math.random() * 100,
                rotationSpeed: -360 + Math.random() * 720,
                gravity: 980,
                duration: 400 + Math.random() * 400,
                startTime: null,
                x: 0, y: 0, rotation: 0, opacity: 1,
                element: null
            };
            
            const cellRect = element.getBoundingClientRect();
            const cellStyle = window.getComputedStyle(element);
            element.style.visibility = 'hidden';
            
            const clone = document.createElement('div');
            clone.className = element.className;
            clone.innerHTML = element.innerHTML;
            Object.assign(clone.style, {
                position: 'fixed',
                left: `${cellRect.left}px`,
                top: `${cellRect.top}px`,
                width: `${cellRect.width}px`,
                height: `${cellRect.height}px`,
                zIndex: '999',
                borderRadius: cellStyle.borderRadius,
                backgroundColor: cellStyle.backgroundColor
            });
            
            document.body.appendChild(clone);
            physics.element = clone;
            
            startPhysicsAnimation(physics, () => {
                if (document.body.contains(clone)) document.body.removeChild(clone);
                completedAnimations++;
                if (completedAnimations === totalAnimations) {
                    activeDomCells.forEach(cell => cell.style.visibility = 'visible');
                    if (onComplete) onComplete();
                }
            });
        }, delay);
    });
}
