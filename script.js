const imageInput = document.getElementById('imageInput');
const imageCanvas = document.getElementById('imageCanvas');
const ctx = imageCanvas.getContext('2d');
const imageContainer = document.querySelector('.image-container');
const cropBox = document.getElementById('cropBox');
const downloadButton = document.getElementById('downloadButton');

let img = new Image();
let isDragging = false;
let isResizing = false;
let resizeHandle = null;
let startX, startY; // Mouse position on mousedown
let initialCropX, initialCropY, initialCropWidth, initialCropHeight; // Crop box state on mousedown

const MIN_CROP_SIZE = 20; // Minimum width/height for crop box

// Event listener for file input change
imageInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            img.onload = function() {
                // Clear previous drawings
                ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);

                // Set canvas dimensions to image dimensions
                imageCanvas.width = img.width;
                imageCanvas.height = img.height;

                // Draw the image onto the canvas
                ctx.drawImage(img, 0, 0, img.width, img.height);

                // Set container size based on image, but respect max-width/height
                const containerRect = imageContainer.getBoundingClientRect();
                 // We need to calculate scaled dimensions if the image is larger than container max size
                const maxWidth = imageContainer.clientWidth; // Use clientWidth after CSS applied
                const maxHeight = imageContainer.clientHeight; // Use clientHeight

                let displayWidth = img.width;
                let displayHeight = img.height;

                // Scale image to fit within container while maintaining aspect ratio
                if (displayWidth > maxWidth) {
                    displayHeight *= maxWidth / displayWidth;
                    displayWidth = maxWidth;
                }
                if (displayHeight > maxHeight) {
                     displayWidth *= maxHeight / displayHeight;
                     displayHeight = maxHeight;
                }

                imageCanvas.style.width = `${displayWidth}px`;
                imageCanvas.style.height = `${displayHeight}px`;

                 // Update container size to match the potentially scaled canvas size
                imageContainer.style.width = `${displayWidth}px`;
                imageContainer.style.height = `${displayHeight}px`;


                // Initialize crop box in the center
                const initialSize = Math.min(displayWidth, displayHeight) * 0.5;
                const initialX = (displayWidth - initialSize) / 2;
                const initialY = (displayHeight - initialSize) / 2;

                setCropBoxPositionAndSize(initialX, initialY, initialSize, initialSize);

                // Show the crop box and download button
                cropBox.style.display = 'block';
                downloadButton.style.display = 'block';

            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// Helper to get mouse position relative to imageContainer
function getMousePos(e) {
    const rect = imageContainer.getBoundingClientRect();
    let clientX, clientY;

     // Handle touch events
    if (e.touches) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else { // Handle mouse events
        clientX = e.clientX;
        clientY = e.clientY;
    }


    // Scale mouse position based on displayed image size vs original image size
    const scaleX = img.width / imageCanvas.clientWidth;
    const scaleY = img.height / imageCanvas.clientHeight;


    const x = (clientX - rect.left);
    const y = (clientY - rect.top);

    // Return position relative to the *displayed* image container
    return { x: x, y: y };
}

// Helper to set crop box position and size (uses values relative to displayed image)
function setCropBoxPositionAndSize(x, y, w, h) {
    // Clamp values to within image bounds
    const containerWidth = imageContainer.clientWidth;
    const containerHeight = imageContainer.clientHeight;

    x = Math.max(0, Math.min(x, containerWidth - MIN_CROP_SIZE));
    y = Math.max(0, Math.min(y, containerHeight - MIN_CROP_SIZE));
    w = Math.max(MIN_CROP_SIZE, Math.min(w, containerWidth - x));
    h = Math.max(MIN_CROP_SIZE, Math.min(h, containerHeight - y));


    cropBox.style.left = `${x}px`;
    cropBox.style.top = `${y}px`;
    cropBox.style.width = `${w}px`;
    cropBox.style.height = `${h}px`;

     // Update initial values for drag/resize operations to use *pixel* values
    initialCropX = x;
    initialCropY = y;
    initialCropWidth = w;
    initialCropHeight = h;
}


// Mousedown handler on the image container
imageContainer.addEventListener('mousedown', handleStart);
imageContainer.addEventListener('touchstart', handleStart, { passive: false }); // Add touch support

function handleStart(e) {
    // Prevent default touch behavior like scrolling
    if (e.cancelable) {
         e.preventDefault();
    }


    const mousePos = getMousePos(e);
    startX = mousePos.x;
    startY = mousePos.y;

    const cropRect = cropBox.getBoundingClientRect();
    const containerRect = imageContainer.getBoundingClientRect();

    // Calculate position relative to the image container top-left
    const cropX = cropRect.left - containerRect.left;
    const cropY = cropRect.top - containerRect.top;
    const cropWidth = cropRect.width;
    const cropHeight = cropRect.height;


    // Check if click is inside the crop box
    if (startX >= cropX && startX <= cropX + cropWidth &&
        startY >= cropY && startY <= cropY + cropHeight) {

        initialCropX = cropX;
        initialCropY = cropY;
        initialCropWidth = cropWidth;
        initialCropHeight = cropHeight;

        // Check if click is on a resize handle
        const handles = cropBox.querySelectorAll('.resize-handle');
        let onHandle = false;
        handles.forEach(handle => {
            const handleRect = handle.getBoundingClientRect();
             // Check if mouse is within handle bounds (relative to viewport)
            if (mousePos.x >= (handleRect.left - containerRect.left) && mousePos.x <= (handleRect.right - containerRect.left) &&
                mousePos.y >= (handleRect.top - containerRect.top) && mousePos.y <= (handleRect.bottom - containerRect.top)) {
                isResizing = true;
                resizeHandle = handle.classList[1]; // Get handle class name (e.g., 'top-left')
                onHandle = true;
            }
        });

        if (!onHandle) {
             // If not on a handle, assume dragging the box
            isDragging = true;
            cropBox.style.cursor = 'grabbing';
        }


    }
}

// Mousemove handler on the document
document.addEventListener('mousemove', handleMove);
document.addEventListener('touchmove', handleMove, { passive: false }); // Add touch support

function handleMove(e) {
     if (e.cancelable) {
         e.preventDefault();
    }

    if (!isDragging && !isResizing) return;

    const mousePos = getMousePos(e);
    const deltaX = mousePos.x - startX;
    const deltaY = mousePos.y - startY;

    const containerWidth = imageContainer.clientWidth;
    const containerHeight = imageContainer.clientHeight;


    if (isDragging) {
        let newX = initialCropX + deltaX;
        let newY = initialCropY + deltaY;

        // Clamp dragging within bounds
        newX = Math.max(0, Math.min(newX, containerWidth - initialCropWidth));
        newY = Math.max(0, Math.min(newY, containerHeight - initialCropHeight));

        cropBox.style.left = `${newX}px`;
        cropBox.style.top = `${newY}px`;

    } else if (isResizing) {
        let newX = initialCropX;
        let newY = initialCropY;
        let newWidth = initialCropWidth;
        let newHeight = initialCropHeight;

        switch (resizeHandle) {
            case 'top-left':
                newX = Math.min(initialCropX + deltaX, initialCropX + initialCropWidth - MIN_CROP_SIZE);
                newY = Math.min(initialCropY + deltaY, initialCropY + initialCropHeight - MIN_CROP_SIZE);
                newWidth = initialCropWidth - (newX - initialCropX);
                newHeight = initialCropHeight - (newY - initialCropY);
                break;
            case 'top-right':
                 newY = Math.min(initialCropY + deltaY, initialCropY + initialCropHeight - MIN_CROP_SIZE);
                 newWidth = Math.max(MIN_CROP_SIZE, initialCropWidth + deltaX);
                 newHeight = initialCropHeight - (newY - initialCropY);
                 break;
            case 'bottom-left':
                 newX = Math.min(initialCropX + deltaX, initialCropX + initialCropWidth - MIN_CROP_SIZE);
                 newWidth = initialCropWidth - (newX - initialCropX);
                 newHeight = Math.max(MIN_CROP_SIZE, initialCropHeight + deltaY);
                 break;
            case 'bottom-right':
                 newWidth = Math.max(MIN_CROP_SIZE, initialCropWidth + deltaX);
                 newHeight = Math.max(MIN_CROP_SIZE, initialCropHeight + deltaY);
                 break;
            case 'top':
                 newY = Math.min(initialCropY + deltaY, initialCropY + initialCropHeight - MIN_CROP_SIZE);
                 newHeight = initialCropHeight - (newY - initialCropY);
                 break;
            case 'bottom':
                 newHeight = Math.max(MIN_CROP_SIZE, initialCropHeight + deltaY);
                 break;
            case 'left':
                 newX = Math.min(initialCropX + deltaX, initialCropX + initialCropWidth - MIN_CROP_SIZE);
                 newWidth = initialCropWidth - (newX - initialCropX);
                 break;
            case 'right':
                 newWidth = Math.max(MIN_CROP_SIZE, initialCropWidth + deltaX);
                 break;
        }

        // Clamp overall box position and size
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);
        newWidth = Math.min(newWidth, containerWidth - newX);
        newHeight = Math.min(newHeight, containerHeight - newY);

        // Ensure minimum size
        if (newWidth < MIN_CROP_SIZE) {
             if (resizeHandle.includes('left')) newX = newX + newWidth - MIN_CROP_SIZE;
             newWidth = MIN_CROP_SIZE;
        }
         if (newHeight < MIN_CROP_SIZE) {
             if (resizeHandle.includes('top')) newY = newY + newHeight - MIN_CROP_SIZE;
             newHeight = MIN_CROP_SIZE;
        }


        cropBox.style.left = `${newX}px`;
        cropBox.style.top = `${newY}px`;
        cropBox.style.width = `${newWidth}px`;
        cropBox.style.height = `${newHeight}px`;
    }
}

// Mouseup handler on the document
document.addEventListener('mouseup', handleEnd);
document.addEventListener('touchend', handleEnd); // Add touch support
document.addEventListener('touchcancel', handleEnd); // Add touch support

function handleEnd() {
    isDragging = false;
    isResizing = false;
    resizeHandle = null;
    cropBox.style.cursor = 'move'; // Reset cursor
}

// Download button listener
downloadButton.addEventListener('click', function() {
    if (!img.src) {
        alert("Please upload an image first.");
        return;
    }

    const cropRect = cropBox.getBoundingClientRect();
    const containerRect = imageContainer.getBoundingClientRect();

    // Calculate crop position and size relative to the *displayed* image
    const cropX_display = cropRect.left - containerRect.left;
    const cropY_display = cropRect.top - containerRect.top;
    const cropWidth_display = cropRect.width;
    const cropHeight_display = cropRect.height;

    // Calculate scaling factors between original image and displayed image
    const scaleX = img.width / imageCanvas.clientWidth;
    const scaleY = img.height / imageCanvas.clientHeight;

    // Calculate crop position and size relative to the *original* image
    const cropX_original = cropX_display * scaleX;
    const cropY_original = cropY_display * scaleY;
    const cropWidth_original = cropWidth_display * scaleX;
    const cropHeight_original = cropHeight_display * scaleY;

    // Create a temporary canvas for cropping
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cropWidth_original;
    tempCanvas.height = cropHeight_original;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw the cropped region from the original image onto the temporary canvas
    tempCtx.drawImage(
        img,
        cropX_original, // Source x
        cropY_original, // Source y
        cropWidth_original, // Source width
        cropHeight_original, // Source height
        0, // Destination x
        0, // Destination y
        cropWidth_original, // Destination width
        cropHeight_original // Destination height
    );

    // Get the image data as a Blob
    tempCanvas.toBlob(function(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cropped-image.png'; // Suggest a filename
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url); // Clean up the URL object
    }, 'image/png'); // Specify the output format
});

