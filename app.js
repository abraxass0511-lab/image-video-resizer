/**
 * 사진 크기 및 용량 변환기
 * Client-side image resizer with file-size targeting
 */

// ===== Tab Navigation =====
(() => {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;

            tabBtns.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');

            tabContents.forEach((content) => {
                if (content.id === targetTab + 'Tab') {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
        });
    });
})();

// ===== Image Tab =====
(() => {
    'use strict';

    // ===== DOM Elements =====
    const $ = (sel) => document.querySelector(sel);
    const uploadArea = $('#uploadArea');
    const fileInput = $('#fileInput');
    const originalInfo = $('#originalInfo');
    const originalPreview = $('#originalPreview');
    const originalFileName = $('#originalFileName');
    const originalDimensions = $('#originalDimensions');
    const originalSize = $('#originalSize');
    const originalFormat = $('#originalFormat');
    const btnRemove = $('#btnRemove');
    const settingsSection = $('#settingsSection');
    const widthInput = $('#widthInput');
    const heightInput = $('#heightInput');

    const maxSizeInput = $('#maxSizeInput');
    const sizeUnit = $('#sizeUnit');
    const btnConvert = $('#btnConvert');
    const resultSection = $('#resultSection');
    const compareOriginal = $('#compareOriginal');
    const compareResult = $('#compareResult');
    const origStatDim = $('#origStatDim');
    const origStatSize = $('#origStatSize');
    const resultStatDim = $('#resultStatDim');
    const resultStatSize = $('#resultStatSize');
    const reductionBadge = $('#reductionBadge');
    const reductionText = $('#reductionText');
    const statusMessage = $('#statusMessage');
    const btnDownload = $('#btnDownload');
    const btnRetry = $('#btnRetry');
    const processingOverlay = $('#processingOverlay');
    const canvas = $('#canvas');
    const ctx = canvas.getContext('2d');

    // ===== State =====
    let state = {
        file: null,
        originalImage: null,
        originalWidth: 0,
        originalHeight: 0,
        originalFileSize: 0,
        resultBlob: null,
        resultDataUrl: null,
    };

    // ===== Upload Handling =====
    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFile(files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });

    function handleFile(file) {
        const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            alert('PNG, JPG, WEBP 파일만 지원합니다.');
            return;
        }
        if (file.size > 50 * 1024 * 1024) {
            alert('파일 크기는 50MB 이하만 가능합니다.');
            return;
        }

        state.file = file;
        state.originalFileSize = file.size;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                state.originalImage = img;
                state.originalWidth = img.naturalWidth;
                state.originalHeight = img.naturalHeight;

                showOriginalInfo(file, img);
                showSettings();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function showOriginalInfo(file, img) {
        originalPreview.src = img.src;
        originalFileName.textContent = file.name;
        originalDimensions.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
        originalSize.textContent = formatFileSize(file.size);
        originalFormat.textContent = file.type.split('/')[1].toUpperCase();
        originalInfo.style.display = 'block';
        uploadArea.style.display = 'none';
    }

    function showSettings() {
        settingsSection.style.display = 'block';
        settingsSection.style.animation = 'none';
        settingsSection.offsetHeight; // trigger reflow
        settingsSection.style.animation = 'fadeInUp 0.5s ease both';
        resultSection.style.display = 'none';
    }

    // ===== Remove Image =====
    btnRemove.addEventListener('click', () => {
        state.file = null;
        state.originalImage = null;
        state.resultBlob = null;
        state.resultDataUrl = null;
        fileInput.value = '';

        originalInfo.style.display = 'none';
        uploadArea.style.display = 'block';
        settingsSection.style.display = 'none';
        resultSection.style.display = 'none';
    });

    // ===== Input change clears presets =====
    widthInput.addEventListener('input', () => {
        clearPresetActive('dimension');
    });

    heightInput.addEventListener('input', () => {
        clearPresetActive('dimension');
    });

    // ===== Presets =====
    document.querySelectorAll('.preset-btn:not(.size-preset)').forEach((btn) => {
        btn.addEventListener('click', () => {
            const w = parseInt(btn.dataset.w);
            const h = parseInt(btn.dataset.h);
            widthInput.value = w;
            heightInput.value = h;

            document.querySelectorAll('.preset-btn:not(.size-preset)').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    document.querySelectorAll('.size-preset').forEach((btn) => {
        btn.addEventListener('click', () => {
            const size = parseFloat(btn.dataset.size);
            const unit = btn.dataset.unit;
            maxSizeInput.value = size;
            sizeUnit.value = unit;

            document.querySelectorAll('.size-preset').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    function clearPresetActive(type) {
        if (type === 'dimension') {
            document.querySelectorAll('.preset-btn:not(.size-preset)').forEach((b) => b.classList.remove('active'));
        }
    }

    maxSizeInput.addEventListener('input', () => {
        document.querySelectorAll('.size-preset').forEach((b) => b.classList.remove('active'));
    });

    // ===== Convert =====
    btnConvert.addEventListener('click', async () => {
        if (!state.originalImage) {
            alert('이미지를 먼저 업로드해주세요.');
            return;
        }

        const targetW = parseInt(widthInput.value);
        const targetH = parseInt(heightInput.value);
        if (!targetW || !targetH || targetW < 1 || targetH < 1) {
            alert('올바른 픽셀 크기를 입력해주세요.');
            return;
        }

        const maxSizeVal = parseFloat(maxSizeInput.value);
        if (!maxSizeVal || maxSizeVal <= 0) {
            alert('올바른 최대 용량을 입력해주세요.');
            return;
        }

        const maxBytes = sizeUnit.value === 'MB' ? maxSizeVal * 1024 * 1024 : maxSizeVal * 1024;
        const format = document.querySelector('input[name="format"]:checked').value;

        processingOverlay.style.display = 'flex';

        // Use requestAnimationFrame to ensure overlay is rendered
        requestAnimationFrame(() => {
            requestAnimationFrame(async () => {
                try {
                    const result = await resizeImage(state.originalImage, targetW, targetH, format, maxBytes);
                    state.resultBlob = result.blob;
                    state.resultDataUrl = result.dataUrl;
                    showResult(targetW, targetH, result);
                } catch (err) {
                    console.error(err);
                    alert('이미지 변환 중 오류가 발생했습니다: ' + err.message);
                } finally {
                    processingOverlay.style.display = 'none';
                }
            });
        });
    });

    /**
     * Resize image and compress to fit within maxBytes
     */
    async function resizeImage(img, targetW, targetH, format, maxBytes) {
        // Draw resized image
        canvas.width = targetW;
        canvas.height = targetH;
        ctx.clearRect(0, 0, targetW, targetH);

        // Use high-quality downscaling for large reductions
        if (img.naturalWidth > targetW * 4 || img.naturalHeight > targetH * 4) {
            // Step-down approach for better quality
            stepDownDraw(img, targetW, targetH);
        } else {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, targetW, targetH);
        }

        // For PNG, we can't control quality via toBlob quality param effectively
        // We'll handle it differently
        if (format === 'image/png') {
            const dataUrl = canvas.toDataURL('image/png');
            const blob = dataURLtoBlob(dataUrl);

            return {
                blob,
                dataUrl,
                size: blob.size,
                achievedTarget: blob.size <= maxBytes,
            };
        }

        // For JPEG/WEBP: binary search for quality to match target size
        let low = 0.01;
        let high = 1.0;
        let bestBlob = null;
        let bestDataUrl = null;
        let iterations = 0;
        const maxIterations = 20;

        while (iterations < maxIterations && (high - low) > 0.005) {
            const mid = (low + high) / 2;
            const dataUrl = canvas.toDataURL(format, mid);
            const blob = dataURLtoBlob(dataUrl);

            if (blob.size <= maxBytes) {
                bestBlob = blob;
                bestDataUrl = dataUrl;
                low = mid;
            } else {
                high = mid;
            }
            iterations++;
        }

        // If even lowest quality is too big, use it anyway
        if (!bestBlob) {
            const dataUrl = canvas.toDataURL(format, 0.01);
            bestBlob = dataURLtoBlob(dataUrl);
            bestDataUrl = dataUrl;
        }

        return {
            blob: bestBlob,
            dataUrl: bestDataUrl,
            size: bestBlob.size,
            achievedTarget: bestBlob.size <= maxBytes,
        };
    }

    /**
     * Step-down drawing for better quality when downscaling significantly
     */
    function stepDownDraw(img, targetW, targetH) {
        let currentW = img.naturalWidth;
        let currentH = img.naturalHeight;

        // Create a temporary canvas
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        // First draw at original size
        tempCanvas.width = currentW;
        tempCanvas.height = currentH;
        tempCtx.drawImage(img, 0, 0);

        // Step down by half until close to target
        while (currentW / 2 > targetW && currentH / 2 > targetH) {
            currentW = Math.max(Math.floor(currentW / 2), targetW);
            currentH = Math.max(Math.floor(currentH / 2), targetH);

            const stepCanvas = document.createElement('canvas');
            stepCanvas.width = currentW;
            stepCanvas.height = currentH;
            const stepCtx = stepCanvas.getContext('2d');
            stepCtx.imageSmoothingEnabled = true;
            stepCtx.imageSmoothingQuality = 'high';
            stepCtx.drawImage(tempCanvas, 0, 0, currentW, currentH);

            tempCanvas.width = currentW;
            tempCanvas.height = currentH;
            tempCtx.drawImage(stepCanvas, 0, 0);
        }

        // Final draw to target size
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(tempCanvas, 0, 0, targetW, targetH);
    }

    /**
     * Convert data URL to Blob
     */
    function dataURLtoBlob(dataUrl) {
        const parts = dataUrl.split(',');
        const mime = parts[0].match(/:(.*?);/)[1];
        const bstr = atob(parts[1]);
        const n = bstr.length;
        const u8arr = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
            u8arr[i] = bstr.charCodeAt(i);
        }
        return new Blob([u8arr], { type: mime });
    }

    // ===== Show Result =====
    function showResult(targetW, targetH, result) {
        // Original
        compareOriginal.src = state.originalImage.src;
        origStatDim.textContent = `${state.originalWidth} × ${state.originalHeight}`;
        origStatSize.textContent = formatFileSize(state.originalFileSize);

        // Result
        compareResult.src = result.dataUrl;
        resultStatDim.textContent = `${targetW} × ${targetH}`;
        resultStatSize.textContent = formatFileSize(result.size);

        // Reduction
        const reduction = ((1 - result.size / state.originalFileSize) * 100).toFixed(1);
        if (reduction > 0) {
            reductionText.textContent = `용량 ${reduction}% 감소`;
            reductionBadge.style.display = 'flex';
        } else {
            reductionText.textContent = `용량 ${Math.abs(reduction)}% 증가`;
            reductionBadge.style.display = 'flex';
        }

        // Status
        const maxBytes = sizeUnit.value === 'MB'
            ? parseFloat(maxSizeInput.value) * 1024 * 1024
            : parseFloat(maxSizeInput.value) * 1024;

        statusMessage.className = 'status-message';
        if (result.achievedTarget) {
            statusMessage.classList.add('success');
            statusMessage.textContent = `✅ 목표 용량(${formatFileSize(maxBytes)} 이하) 달성! 다운로드 준비 완료.`;
        } else {
            statusMessage.classList.add('warning');
            statusMessage.textContent = `⚠️ 최저 품질에서도 ${formatFileSize(result.size)}입니다. 목표(${formatFileSize(maxBytes)})보다 큽니다. 더 작은 픽셀 크기를 시도해보세요.`;
        }

        // Show result section
        resultSection.style.display = 'block';
        resultSection.style.animation = 'none';
        resultSection.offsetHeight;
        resultSection.style.animation = 'fadeInUp 0.5s ease both';

        // Scroll to result
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ===== Download =====
    btnDownload.addEventListener('click', () => {
        if (!state.resultBlob) return;

        const format = document.querySelector('input[name="format"]:checked').value;
        const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/png' ? 'png' : 'webp';
        const baseName = state.file ? state.file.name.replace(/\.[^.]+$/, '') : 'image';
        const w = widthInput.value;
        const h = heightInput.value;
        const fileName = `${baseName}_${w}x${h}.${ext}`;

        const a = document.createElement('a');
        a.href = URL.createObjectURL(state.resultBlob);
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    });

    // ===== Retry =====
    btnRetry.addEventListener('click', () => {
        resultSection.style.display = 'none';
        settingsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // ===== Utility =====
    function formatFileSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
})();
