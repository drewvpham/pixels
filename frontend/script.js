const colorMap = {
  0: "#FFFFFF", // white
  1: "#74B63E", // green
  2: "#FFCE33", // yellow
  3: "#CC421D", // red
  4: "#FF8533", // orange
  5: "#87308C", // purple
  6: "#1D70A2", // blue
  7: "#079D9D", // teal
  8: "#F05689", // pink
  9: "#000000", // black
};

window.onload = () => {
  const canvas = document.getElementById("canvas");
  const loadingSpinner = document.getElementById("loading");
  const context = canvas.getContext("2d");
  const colorButtons = document.querySelectorAll(".color-button");

  const canvasSize = Math.min(window.innerWidth - 50, 600);

  canvas.width = canvasSize;
  canvas.height = canvasSize;

  const gridSize = 100;
  let pixelData = "";
  let pixelSize = canvasSize / 100;
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;
  let isMouseDown = false;
  let lastX, lastY;
  let selectedColor = "9";
  let lastTouchDistance = 0;
  let touchStartTime = 0;
  let selectedButton = document.querySelector(
    '.color-button[data-color="#000000"]',
  );

  selectedButton.classList.add("selected");

  const socket = new WebSocket("wss://pixels-backend.fly.dev/ws");

  socket.onopen = () => {
    console.log("WebSocket connection established");
  };

  socket.onmessage = (event) => {
    pixelData = JSON.parse(event.data).data;
    loadingSpinner.style.display = "none";
    canvas.style.display = "block";
    redraw();
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
    loadingSpinner.textContent =
      "Error connecting to server. Please try again later.";
  };

  socket.onclose = () => {
    console.log("WebSocket connection closed");
  };

  const redraw = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < pixelData.length; i++) {
      const x = (i % gridSize) * pixelSize - offsetX;
      const y = Math.floor(i / gridSize) * pixelSize - offsetY;
      const color = colorMap[pixelData[i]];

      context.fillStyle = color;
      context.fillRect(x, y, pixelSize, pixelSize);
    }
  };

  const applyOffsetLimits = () => {
    const maxOffset = gridSize * pixelSize - canvas.width;
    offsetX = Math.min(maxOffset, Math.max(0, offsetX));
    offsetY = Math.min(maxOffset, Math.max(0, offsetY));
  };

  const zoom = (factor, cursorX, cursorY) => {
    const oldPixelSize = pixelSize;
    pixelSize *= factor;
    const maxPixelSize = canvasSize / 10;
    const minPixelSize = canvasSize / 100;
    pixelSize = Math.max(minPixelSize, Math.min(maxPixelSize, pixelSize));

    offsetX = (offsetX + cursorX) * (pixelSize / oldPixelSize) - cursorX;
    offsetY = (offsetY + cursorY) * (pixelSize / oldPixelSize) - cursorY;

    applyOffsetLimits();

    redraw();
  };

  const getTouchDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const updatePixel = (x, y) => {
    const pixelX = Math.floor((x + offsetX) / pixelSize);
    const pixelY = Math.floor((y + offsetY) / pixelSize);
    const index = pixelY * gridSize + pixelX;

    if (index >= 0 && index < pixelData.length) {
      socket.send(
        JSON.stringify({
          type: "update",
          data: {
            index,
            color: selectedColor,
          },
        }),
      );
    }
  };

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    zoom(zoomFactor, cursorX, cursorY);
  });

  canvas.addEventListener("mousedown", (e) => {
    lastX = e.clientX;
    lastY = e.clientY;
    isMouseDown = true;
  });

  canvas.addEventListener("mousemove", (e) => {
    if (
      isMouseDown &&
      (Math.abs(e.clientX - lastX) > 5 || Math.abs(e.clientY - lastY) > 5)
    ) {
      isDragging = true;
    }

    if (isDragging) {
      const deltaX = e.clientX - lastX;
      const deltaY = e.clientY - lastY;

      offsetX -= deltaX;
      offsetY -= deltaY;

      applyOffsetLimits();

      lastX = e.clientX;
      lastY = e.clientY;
      redraw();
    }
  });

  canvas.addEventListener("mouseup", (e) => {
    if (!isDragging) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      updatePixel(x, y);
    }

    isDragging = false;
    isMouseDown = false;
  });

  canvas.addEventListener("mouseleave", () => {
    isDragging = false;
    isMouseDown = false;
  });

  canvas.addEventListener("touchstart", (e) => {
    touchStartTime = new Date().getTime();
    if (e.touches.length === 2) {
      lastTouchDistance = getTouchDistance(e.touches);
    } else if (e.touches.length === 1) {
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
      isMouseDown = true;
    }
    hasMoved = false;
  });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();

    if (e.touches.length === 2) {
      const currentDistance = getTouchDistance(e.touches);
      const zoomFactor = currentDistance / lastTouchDistance;

      const rect = canvas.getBoundingClientRect();
      const centerX =
        (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const centerY =
        (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

      zoom(zoomFactor, centerX, centerY);

      lastTouchDistance = currentDistance;
    } else if (e.touches.length === 1 && isMouseDown) {
      const deltaX = e.touches[0].clientX - lastX;
      const deltaY = e.touches[0].clientY - lastY;

      offsetX -= deltaX;
      offsetY -= deltaY;

      applyOffsetLimits();

      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
      redraw();
    }
  });

  canvas.addEventListener("touchend", (e) => {
    const touchEndTime = new Date().getTime();
    const touchDuration = touchEndTime - touchStartTime;

    if (e.touches.length === 0 && touchDuration < 200) {
      const rect = canvas.getBoundingClientRect();
      const x = lastX - rect.left;
      const y = lastY - rect.top;
      updatePixel(x, y);
    }

    isDragging = false;
    isMouseDown = false;
  });

  colorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedColor = Object.keys(colorMap).find(
        (key) => colorMap[key] === button.dataset.color,
      );

      selectedButton.classList.remove("selected");
      button.classList.add("selected");
      selectedButton = button;
    });
  });
};
