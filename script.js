// Audio Context for sound effects
const clickSound = new Audio('click.mp3');
const shutterSound = new Audio('shutter.mp3');

function playClick() {
    clickSound.currentTime = 0;
    clickSound.play().catch(() => {}); // Ignore auto-play blocks
}

// Elements
const fileInput = document.getElementById('fileInput');
const uploadTrigger = document.getElementById('uploadTrigger');
const downloadBtn = document.getElementById('downloadBtn');
const canvas = document.getElementById('editorCanvas');
const ctx = canvas.getContext('2d');
const wrapper = document.querySelector('.canvas-wrapper');
const cropBox = document.getElementById('cropBox');
const editorArea = document.getElementById('editorArea');
const emptyState = document.getElementById('emptyState');
const shapeBtn = document.getElementById('shapeBtn');
const cutBtn = document.getElementById('cutBtn');

// State
let state = {
    img: null,
    rotation: 0, // 0, 90, 180, 270
    aspectRatio: null, // null for free
    isCircle: false,
    crop: { x: 0, y: 0, w: 0, h: 0 }, // Relative to displayed canvas
    imgName: 'image',
    mode: 'crop', // 'crop' | 'cut'
    cutPath: [], // Array of {x, y}
    isCutClosed: false
};

// UI Handlers
uploadTrigger.addEventListener('click', () => {
    playClick();
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        state.imgName = file.name.split('.')[0];
        const reader = new FileReader();
        reader.onload = (evt) => {
            const img = new Image();
            img.onload = () => {
                state.img = img;
                state.rotation = 0;
                resetEditor();
            };
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
    }
});

function resetEditor() {
    emptyState.style.display = 'none';
    wrapper.style.display = 'block';
    downloadBtn.disabled = false;
    
    // Reset Cut State
    state.mode = 'crop';
    state.cutPath = [];
    state.isCutClosed = false;
    cutBtn.classList.remove('active');
    cropBox.style.display = 'block';

    renderCanvas();
    
    // Init crop box to 80% of canvas
    const w = canvas.width * 0.8;
    const h = canvas.height * 0.8;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    
    updateCropState(x, y, w, h);
    if(state.isCircle) enforceCircle();
}

function renderCanvas() {
    if (!state.img) return;

    // Determine canvas size based on rotation
    const isPortrait = state.rotation === 90 || state.rotation === 270;
    const naturalWidth = state.img.width;
    const naturalHeight = state.img.height;
    
    const targetW = isPortrait ? naturalHeight : naturalWidth;
    const targetH = isPortrait ? naturalWidth : naturalHeight;

    // Fit within the editor area max bounds
    const containerW = editorArea.clientWidth - 32; // padding
    const containerH = editorArea.clientHeight - 32;

    const scale = Math.min(containerW / targetW, containerH / targetH);
    
    canvas.width = targetW * scale;
    canvas.height = targetH * scale;

    // Draw with rotation
    ctx.save();
    
    // Clipping for Cut Mode (if closed)
    if (state.mode === 'cut' && state.isCutClosed && state.cutPath.length > 2) {
        ctx.beginPath();
        ctx.moveTo(state.cutPath[0].x, state.cutPath[0].y);
        for (let i = 1; i < state.cutPath.length; i++) {
            ctx.lineTo(state.cutPath[i].x, state.cutPath[i].y);
        }
        ctx.closePath();
        ctx.clip();
    }

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(state.rotation * Math.PI / 180);
    ctx.scale(scale, scale);
    ctx.drawImage(state.img, -naturalWidth / 2, -naturalHeight / 2);
    ctx.restore();

    // Draw Cut Path UI (if in cut mode)
    if (state.mode === 'cut' && state.cutPath.length > 0) {
        ctx.save();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
        
        ctx.beginPath();
        ctx.moveTo(state.cutPath[0].x, state.cutPath[0].y);
        for (let i = 1; i < state.cutPath.length; i++) {
            ctx.lineTo(state.cutPath[i].x, state.cutPath[i].y);
        }
        if (state.isCutClosed) {
            ctx.closePath();
            // Don't fill, we just want to see the boundary, 
            // the clipping above handles the visual "cut"
            ctx.stroke();
        } else {
            ctx.stroke();
            // Draw dots at vertices
            state.cutPath.forEach((p, i) => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, i === 0 ? 5 : 3, 0, Math.PI * 2);
                ctx.fillStyle = i === 0 ? '#fff' : '#3b82f6';
                ctx.fill();
                if (i===0) ctx.stroke(); // border for start point
            });
            
            // Draw line to cursor? No, we don't track cursor here easily without more listeners
        }
        ctx.restore();
    }
}

// Crop Logic
function updateCropState(x, y, w, h) {
    // Clamp
    const min = 40;
    const maxW = canvas.width;
    const maxH = canvas.height;

    // Ensure within bounds
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x + w > maxW) {
        if (w > maxW) w = maxW;
        x = maxW - w;
    }
    if (y + h > maxH) {
        if (h > maxH) h = maxH;
        y = maxH - h;
    }

    state.crop = { x, y, w, h };
    renderCropBox();
}

function renderCropBox() {
    cropBox.style.left = `${state.crop.x}px`;
    cropBox.style.top = `${state.crop.y}px`;
    cropBox.style.width = `${state.crop.w}px`;
    cropBox.style.height = `${state.crop.h}px`;
}

// Drag & Resize
let isDragging = false;
let resizeDir = null; // nw, ne, sw, se, n, s, e, w
let startPos = { x: 0, y: 0 };
let startCrop = { x: 0, y: 0, w: 0, h: 0 };

cropBox.addEventListener('pointerdown', handleStart);

function handleStart(e) {
    e.preventDefault();
    if (!state.img) return;

    const target = e.target;
    if (target.classList.contains('handle')) {
        resizeDir = target.dataset.dir;
    } else {
        isDragging = true;
    }

    startPos = { x: e.clientX, y: e.clientY };
    startCrop = { ...state.crop };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleEnd);
    document.addEventListener('pointercancel', handleEnd);
}

function handleMove(e) {
    if (!isDragging && !resizeDir) return;
    e.preventDefault();

    const dx = e.clientX - startPos.x;
    const dy = e.clientY - startPos.y;

    if (isDragging) {
        updateCropState(startCrop.x + dx, startCrop.y + dy, startCrop.w, startCrop.h);
    } else if (resizeDir) {
        let { x, y, w, h } = startCrop;
        const min = 40;

        // Apply Delta based on handle
        if (resizeDir.includes('e')) w += dx;
        if (resizeDir.includes('w')) { x += dx; w -= dx; }
        if (resizeDir.includes('s')) h += dy;
        if (resizeDir.includes('n')) { y += dy; h -= dy; }

        // Fix negative dimensions (flipping)
        if (w < min) {
             if (resizeDir.includes('w')) x = startCrop.x + startCrop.w - min;
             w = min;
        }
        if (h < min) {
             if (resizeDir.includes('n')) y = startCrop.y + startCrop.h - min;
             h = min;
        }

        // Apply Aspect Ratio if set
        if (state.aspectRatio || state.isCircle) {
            const ratio = state.isCircle ? 1 : state.aspectRatio;
            
            // If dragging corner, preserve ratio based on width or height dominance?
            // Simple approach: width drives height for E/W, height drives width for N/S
            // For corners, let's prioritize width change
            
            if (resizeDir.length === 2) { // Corner
                // If moving diagonally, take the max displacement to feel natural
                if (Math.abs(dx) > Math.abs(dy)) {
                     h = w / ratio;
                     if (resizeDir.includes('n')) y = startCrop.y + startCrop.h - h;
                } else {
                     w = h * ratio;
                     if (resizeDir.includes('w')) x = startCrop.x + startCrop.w - w;
                }
            } else { // Edge
                if (resizeDir === 'e' || resizeDir === 'w') {
                    h = w / ratio;
                    y = startCrop.y + (startCrop.h - h)/2; // Center vertically
                } else {
                    w = h * ratio;
                    x = startCrop.x + (startCrop.w - w)/2; // Center horizontally
                }
            }
        }

        updateCropState(x, y, w, h);
    }
}

function handleEnd() {
    isDragging = false;
    resizeDir = null;
    document.removeEventListener('pointermove', handleMove);
    document.removeEventListener('pointerup', handleEnd);
    document.removeEventListener('pointercancel', handleEnd);
}

// Toolbar actions
document.querySelectorAll('[data-action="ratio"]').forEach(btn => {
    btn.addEventListener('click', () => {
        playClick();
        document.querySelectorAll('[data-action="ratio"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const val = btn.dataset.value;
        state.aspectRatio = val === 'free' ? null : parseFloat(val);
        
        // If switching to ratio, enforce it immediately on current crop
        if (state.aspectRatio) {
            let { x, y, w, h } = state.crop;
            // Adjust height to match width
            h = w / state.aspectRatio;
            // If that overflows, adjust width to match height
            if (y + h > canvas.height) {
                h = canvas.height - y;
                w = h * state.aspectRatio;
            }
             // Center correction if needed? Nah, just fit.
            updateCropState(x, y, w, h);
        }
    });
});

document.getElementById('rotateBtn').addEventListener('click', () => {
    playClick();
    if (!state.img) return;
    state.rotation = (state.rotation + 90) % 360;
    
    // Reset Cut Path on rotation as coordinates shift
    state.cutPath = [];
    state.isCutClosed = false;
    
    renderCanvas();
    // Reset crop to center after rotation because dimensions changed
    const w = canvas.width * 0.8;
    const h = canvas.height * 0.8;
    updateCropState((canvas.width - w)/2, (canvas.height - h)/2, w, h);
});

// Cut Tool
cutBtn.addEventListener('click', () => {
    playClick();
    if (!state.img) return;
    
    if (state.mode === 'cut') {
        // Toggle Off
        state.mode = 'crop';
        cutBtn.classList.remove('active');
        cropBox.style.display = 'block';
        state.cutPath = []; // Clear path when exiting? Maybe safer to clear to avoid confusion
        state.isCutClosed = false;
    } else {
        // Toggle On
        state.mode = 'cut';
        cutBtn.classList.add('active');
        cropBox.style.display = 'none';
        state.cutPath = [];
        state.isCutClosed = false;
        
        // Disable other tools visually
        document.querySelectorAll('[data-action="ratio"]').forEach(b => b.classList.remove('active'));
    }
    renderCanvas();
});

// Canvas Interaction for Cut
wrapper.addEventListener('click', (e) => {
    if (state.mode !== 'cut' || state.isCutClosed || !state.img) return;
    
    // Get coordinates relative to canvas
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if bounds valid
    if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) return;

    // Check distance to start point to close loop
    if (state.cutPath.length > 2) {
        const start = state.cutPath[0];
        const dist = Math.hypot(x - start.x, y - start.y);
        if (dist < 20) {
            // Close loop
            state.isCutClosed = true;
            playClick(); // Feedback
            renderCanvas();
            return;
        }
    }
    
    state.cutPath.push({x, y});
    renderCanvas();
});

shapeBtn.addEventListener('click', () => {
    playClick();
    state.isCircle = !state.isCircle;
    const icon = shapeBtn.querySelector('.shape-icon');
    
    if (state.isCircle) {
        cropBox.classList.add('circle');
        icon.classList.remove('rect');
        icon.classList.add('circle');
        enforceCircle();
    } else {
        cropBox.classList.remove('circle');
        icon.classList.remove('circle');
        icon.classList.add('rect');
    }
});

function enforceCircle() {
    // Circle requires 1:1
    state.aspectRatio = 1; 
    // Find active ratio button if exists, or just deselect all to indicate custom mode? 
    // Actually circle forces 1:1, so highlight 1:1
    document.querySelectorAll('[data-action="ratio"]').forEach(b => {
        b.classList.remove('active');
        if(b.dataset.value === "1") b.classList.add('active');
    });

    let { x, y, w, h } = state.crop;
    const size = Math.min(w, h);
    updateCropState(x, y, size, size);
}

// Download
downloadBtn.addEventListener('click', () => {
    if (!state.img) return;
    shutterSound.play().catch(()=>{});

    const isPortrait = state.rotation === 90 || state.rotation === 270;
    const fullW = isPortrait ? state.img.height : state.img.width;
    const fullH = isPortrait ? state.img.width : state.img.height;
    
    // Calculate Scale Factor between Visible Canvas and Full Res Canvas
    // canvas.width is the display width of the image area
    const scaleFactor = fullW / canvas.width;

    if (state.mode === 'cut' && state.isCutClosed) {
        // POLYGON CUT DOWNLOAD
        
        // 1. Calculate bounding box of the cut path in Full Res coordinates
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        const fullPath = state.cutPath.map(p => {
            const fx = p.x * scaleFactor;
            const fy = p.y * scaleFactor;
            if (fx < minX) minX = fx;
            if (fy < minY) minY = fy;
            if (fx > maxX) maxX = fx;
            if (fy > maxY) maxY = fy;
            return { x: fx, y: fy };
        });

        const w = maxX - minX;
        const h = maxY - minY;
        
        // 2. Setup Final Canvas
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = w;
        finalCanvas.height = h;
        const ctx = finalCanvas.getContext('2d');
        
        // 3. Create Path on Final Canvas (translated by minX, minY)
        ctx.beginPath();
        ctx.moveTo(fullPath[0].x - minX, fullPath[0].y - minY);
        for (let i = 1; i < fullPath.length; i++) {
            ctx.lineTo(fullPath[i].x - minX, fullPath[i].y - minY);
        }
        ctx.closePath();
        ctx.clip();

        // 4. Draw Image into clipped area
        // We need to draw the source image relative to this new crop
        // The source image (rotated) has top-left at (0,0) in fullW/fullH space.
        // We are viewing a window at (minX, minY)
        
        ctx.save();
        // Translate so that the (minX, minY) point of the source aligns with (0,0) of destination
        ctx.translate(-minX, -minY);
        
        // Now do standard rotation/drawing of source
        ctx.translate(fullW/2, fullH/2);
        ctx.rotate(state.rotation * Math.PI / 180);
        ctx.drawImage(state.img, -state.img.width/2, -state.img.height/2);
        
        ctx.restore();

        triggerDownload(finalCanvas);

    } else {
        // STANDARD CROP DOWNLOAD
        
        const offCanvas = document.createElement('canvas');
        offCanvas.width = fullW;
        offCanvas.height = fullH;
        const offCtx = offCanvas.getContext('2d');
        
        // Draw rotated full image
        offCtx.save();
        offCtx.translate(fullW/2, fullH/2);
        offCtx.rotate(state.rotation * Math.PI / 180);
        offCtx.drawImage(state.img, -state.img.width/2, -state.img.height/2);
        offCtx.restore();
        
        const cropX = state.crop.x * scaleFactor;
        const cropY = state.crop.y * scaleFactor;
        const cropW = state.crop.w * scaleFactor;
        const cropH = state.crop.h * scaleFactor;
        
        // Create final canvas
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = cropW;
        finalCanvas.height = cropH;
        const finalCtx = finalCanvas.getContext('2d');
        
        if (state.isCircle) {
            finalCtx.beginPath();
            finalCtx.arc(cropW/2, cropH/2, cropW/2, 0, Math.PI * 2);
            finalCtx.clip();
        }
        
        finalCtx.drawImage(offCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        triggerDownload(finalCanvas);
    }
});

function triggerDownload(canvas) {
    canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.imgName}_cut.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 'image/png');
}

// Initialize icons
shapeBtn.querySelector('.shape-icon').classList.add('rect');