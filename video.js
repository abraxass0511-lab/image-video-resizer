/**
 * 동영상 변환 모듈
 * FFmpeg.wasm 기반 클라이언트 사이드 동영상 리사이즈/압축
 */

(() => {
    'use strict';

    const $ = (sel) => document.querySelector(sel);

    // DOM Elements
    const videoUploadArea = $('#videoUploadArea');
    const videoFileInput = $('#videoFileInput');
    const videoOriginalInfo = $('#videoOriginalInfo');
    const videoOriginalPreview = $('#videoOriginalPreview');
    const videoOriginalFileName = $('#videoOriginalFileName');
    const videoOriginalDimensions = $('#videoOriginalDimensions');
    const videoOriginalSize = $('#videoOriginalSize');
    const videoOriginalDuration = $('#videoOriginalDuration');
    const videoBtnRemove = $('#videoBtnRemove');
    const videoSettingsSection = $('#videoSettingsSection');
    const videoWidthInput = $('#videoWidthInput');
    const videoHeightInput = $('#videoHeightInput');
    const videoMaxSizeInput = $('#videoMaxSizeInput');
    const videoSizeUnit = $('#videoSizeUnit');
    const videoConvertBtn = $('#videoConvertBtn');
    const videoProgressSection = $('#videoProgressSection');
    const videoProgressBar = $('#videoProgressBar');
    const videoProgressText = $('#videoProgressText');
    const videoProgressDetail = $('#videoProgressDetail');
    const videoResultSection = $('#videoResultSection');
    const videoCompareOriginal = $('#videoCompareOriginal');
    const videoCompareResult = $('#videoCompareResult');
    const videoOrigStatDim = $('#videoOrigStatDim');
    const videoOrigStatSize = $('#videoOrigStatSize');
    const videoResultStatDim = $('#videoResultStatDim');
    const videoResultStatSize = $('#videoResultStatSize');
    const videoReductionBadge = $('#videoReductionBadge');
    const videoReductionText = $('#videoReductionText');
    const videoStatusMessage = $('#videoStatusMessage');
    const videoDownloadBtn = $('#videoDownloadBtn');
    const videoRetryBtn = $('#videoRetryBtn');

    // State
    let state = {
        file: null,
        originalWidth: 0,
        originalHeight: 0,
        originalFileSize: 0,
        duration: 0,
        resultBlob: null,
        resultUrl: null,
        ffmpegLoaded: false,
    };

    let ffmpeg = null;

    // ===== Upload Handling =====
    videoUploadArea.addEventListener('click', () => videoFileInput.click());

    videoUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        videoUploadArea.classList.add('dragover');
    });

    videoUploadArea.addEventListener('dragleave', () => {
        videoUploadArea.classList.remove('dragover');
    });

    videoUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        videoUploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) handleVideoFile(files[0]);
    });

    videoFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleVideoFile(e.target.files[0]);
    });

    function handleVideoFile(file) {
        const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'];
        if (!validTypes.includes(file.type)) {
            alert('MP4, WEBM, MOV, MKV 파일만 지원합니다.');
            return;
        }
        if (file.size > 500 * 1024 * 1024) {
            alert('파일 크기는 500MB 이하만 가능합니다.');
            return;
        }

        state.file = file;
        state.originalFileSize = file.size;

        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.preload = 'metadata';

        video.onloadedmetadata = () => {
            state.originalWidth = video.videoWidth;
            state.originalHeight = video.videoHeight;
            state.duration = video.duration;

            videoOriginalPreview.src = url;
            videoOriginalFileName.textContent = file.name;
            videoOriginalDimensions.textContent = `${video.videoWidth} × ${video.videoHeight}`;
            videoOriginalSize.textContent = formatFileSize(file.size);
            videoOriginalDuration.textContent = formatDuration(video.duration);

            videoOriginalInfo.style.display = 'block';
            videoUploadArea.style.display = 'none';

            // Show settings
            videoSettingsSection.style.display = 'block';
            videoSettingsSection.style.animation = 'none';
            videoSettingsSection.offsetHeight;
            videoSettingsSection.style.animation = 'fadeInUp 0.5s ease both';
            videoResultSection.style.display = 'none';
        };

        video.src = url;
    }

    // ===== Remove Video =====
    videoBtnRemove.addEventListener('click', () => {
        if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
        state = {
            file: null, originalWidth: 0, originalHeight: 0,
            originalFileSize: 0, duration: 0, resultBlob: null, resultUrl: null,
            ffmpegLoaded: state.ffmpegLoaded,
        };
        videoFileInput.value = '';
        videoOriginalInfo.style.display = 'none';
        videoUploadArea.style.display = 'block';
        videoSettingsSection.style.display = 'none';
        videoResultSection.style.display = 'none';
        videoProgressSection.style.display = 'none';
    });

    // ===== Presets =====
    document.querySelectorAll('.video-res-preset').forEach((btn) => {
        btn.addEventListener('click', () => {
            videoWidthInput.value = btn.dataset.w;
            videoHeightInput.value = btn.dataset.h;
            document.querySelectorAll('.video-res-preset').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    document.querySelectorAll('.video-size-preset').forEach((btn) => {
        btn.addEventListener('click', () => {
            videoMaxSizeInput.value = btn.dataset.size;
            videoSizeUnit.value = btn.dataset.unit;
            document.querySelectorAll('.video-size-preset').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    videoWidthInput.addEventListener('input', () => {
        document.querySelectorAll('.video-res-preset').forEach((b) => b.classList.remove('active'));
    });
    videoHeightInput.addEventListener('input', () => {
        document.querySelectorAll('.video-res-preset').forEach((b) => b.classList.remove('active'));
    });
    videoMaxSizeInput.addEventListener('input', () => {
        document.querySelectorAll('.video-size-preset').forEach((b) => b.classList.remove('active'));
    });

    // ===== Convert =====
    videoConvertBtn.addEventListener('click', async () => {
        if (!state.file) {
            alert('동영상을 먼저 업로드해주세요.');
            return;
        }

        const targetW = parseInt(videoWidthInput.value);
        const targetH = parseInt(videoHeightInput.value);
        if (!targetW || !targetH || targetW < 16 || targetH < 16) {
            alert('올바른 해상도를 입력해주세요. (최소 16px)');
            return;
        }

        // Ensure even numbers for video encoding
        const evenW = targetW % 2 === 0 ? targetW : targetW + 1;
        const evenH = targetH % 2 === 0 ? targetH : targetH + 1;

        const maxSizeVal = parseFloat(videoMaxSizeInput.value);
        if (!maxSizeVal || maxSizeVal <= 0) {
            alert('올바른 최대 용량을 입력해주세요.');
            return;
        }

        const maxBytes = videoSizeUnit.value === 'MB' ? maxSizeVal * 1024 * 1024 : maxSizeVal * 1024;

        // Calculate target bitrate (bits per second)
        // formula: bitrate = (target_size_bytes * 8) / duration_seconds
        // subtract ~128kbps for audio
        const audioBitrate = 128 * 1000; // 128kbps
        let targetBitrate = Math.floor((maxBytes * 8) / state.duration) - audioBitrate;
        if (targetBitrate < 50000) targetBitrate = 50000; // minimum 50kbps

        // Show progress
        videoSettingsSection.style.display = 'none';
        videoProgressSection.style.display = 'block';
        videoProgressSection.style.animation = 'none';
        videoProgressSection.offsetHeight;
        videoProgressSection.style.animation = 'fadeInUp 0.5s ease both';
        videoProgressBar.style.width = '0%';
        videoProgressText.textContent = 'FFmpeg 로딩 중...';
        videoProgressDetail.textContent = '처음 실행 시 약 25MB를 다운로드합니다';

        try {
            await loadFFmpeg();

            videoProgressText.textContent = '동영상 변환 중...';
            videoProgressDetail.textContent = '파일 크기와 해상도에 따라 시간이 다릅니다';

            // Write input file
            const inputData = new Uint8Array(await state.file.arrayBuffer());
            await ffmpeg.writeFile('input.mp4', inputData);

            videoProgressBar.style.width = '10%';

            // Run ffmpeg command
            const bitrateStr = Math.floor(targetBitrate / 1000) + 'k';
            const audioBitrateStr = '128k';

            await ffmpeg.exec([
                '-i', 'input.mp4',
                '-vf', `scale=${evenW}:${evenH}`,
                '-b:v', bitrateStr,
                '-maxrate', bitrateStr,
                '-bufsize', Math.floor(targetBitrate / 500) + 'k',
                '-b:a', audioBitrateStr,
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-c:a', 'aac',
                '-movflags', '+faststart',
                '-y',
                'output.mp4'
            ]);

            videoProgressBar.style.width = '90%';

            // Read output
            const outputData = await ffmpeg.readFile('output.mp4');
            state.resultBlob = new Blob([outputData.buffer], { type: 'video/mp4' });
            state.resultUrl = URL.createObjectURL(state.resultBlob);

            videoProgressBar.style.width = '100%';

            // Cleanup ffmpeg files
            try {
                await ffmpeg.deleteFile('input.mp4');
                await ffmpeg.deleteFile('output.mp4');
            } catch (e) { /* ignore */ }

            showVideoResult(evenW, evenH, maxBytes);

        } catch (err) {
            console.error('Video conversion error:', err);
            alert('동영상 변환 중 오류가 발생했습니다:\n' + err.message + '\n\n모바일에서는 큰 파일이 실패할 수 있습니다. PC에서 시도해보세요.');
            videoProgressSection.style.display = 'none';
            videoSettingsSection.style.display = 'block';
        }
    });

    // ===== Load FFmpeg =====
    async function loadFFmpeg() {
        if (state.ffmpegLoaded && ffmpeg) return;

        videoProgressText.textContent = 'FFmpeg 초기화 중...';
        videoProgressBar.style.width = '2%';

        try {
            // Use locally hosted UMD builds (loaded via script tags)
            const { FFmpeg } = FFmpegWASM;
            const { toBlobURL } = FFmpegUtil;

            ffmpeg = new FFmpeg();

            ffmpeg.on('progress', ({ progress }) => {
                const pct = Math.min(Math.max(Math.round(progress * 80) + 10, 10), 90);
                videoProgressBar.style.width = pct + '%';
                videoProgressText.textContent = `변환 중... ${pct}%`;
            });

            ffmpeg.on('log', ({ message }) => {
                if (message && message.length < 120) {
                    videoProgressDetail.textContent = message;
                }
            });

            videoProgressText.textContent = 'FFmpeg 코어 다운로드 중...';
            videoProgressBar.style.width = '5%';

            const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

            const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
            videoProgressBar.style.width = '7%';

            const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
            videoProgressBar.style.width = '9%';

            videoProgressText.textContent = 'FFmpeg 로드 중...';

            // Worker (814.ffmpeg.js) is loaded automatically from same-origin by the UMD bundle
            await ffmpeg.load({ coreURL, wasmURL });
            state.ffmpegLoaded = true;

            videoProgressText.textContent = 'FFmpeg 로드 완료!';
            videoProgressBar.style.width = '10%';
        } catch (err) {
            console.error('FFmpeg load error:', err);
            throw new Error('FFmpeg 로드 실패: ' + (err.message || err));
        }
    }

    // ===== Show Video Result =====
    function showVideoResult(targetW, targetH, maxBytes) {
        videoProgressSection.style.display = 'none';

        // Original
        videoCompareOriginal.src = URL.createObjectURL(state.file);
        videoOrigStatDim.textContent = `${state.originalWidth} × ${state.originalHeight}`;
        videoOrigStatSize.textContent = formatFileSize(state.originalFileSize);

        // Result
        videoCompareResult.src = state.resultUrl;
        videoResultStatDim.textContent = `${targetW} × ${targetH}`;
        videoResultStatSize.textContent = formatFileSize(state.resultBlob.size);

        // Reduction
        const reduction = ((1 - state.resultBlob.size / state.originalFileSize) * 100).toFixed(1);
        if (reduction > 0) {
            videoReductionText.textContent = `용량 ${reduction}% 감소`;
        } else {
            videoReductionText.textContent = `용량 ${Math.abs(reduction)}% 증가`;
        }
        videoReductionBadge.style.display = 'flex';

        // Status
        videoStatusMessage.className = 'status-message';
        if (state.resultBlob.size <= maxBytes) {
            videoStatusMessage.classList.add('success');
            videoStatusMessage.textContent = `✅ 목표 용량(${formatFileSize(maxBytes)} 이하) 달성! 다운로드 준비 완료.`;
        } else {
            videoStatusMessage.classList.add('warning');
            videoStatusMessage.textContent = `⚠️ 결과 ${formatFileSize(state.resultBlob.size)}. 목표(${formatFileSize(maxBytes)})보다 큽니다. 더 낮은 해상도나 큰 용량 목표를 시도해보세요.`;
        }

        // Show
        videoResultSection.style.display = 'block';
        videoResultSection.style.animation = 'none';
        videoResultSection.offsetHeight;
        videoResultSection.style.animation = 'fadeInUp 0.5s ease both';
        videoResultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ===== Download =====
    videoDownloadBtn.addEventListener('click', () => {
        if (!state.resultBlob) return;

        const baseName = state.file ? state.file.name.replace(/\.[^.]+$/, '') : 'video';
        const w = videoWidthInput.value;
        const h = videoHeightInput.value;
        const fileName = `${baseName}_${w}x${h}.mp4`;

        const a = document.createElement('a');
        a.href = state.resultUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    // ===== Retry =====
    videoRetryBtn.addEventListener('click', () => {
        videoResultSection.style.display = 'none';
        videoSettingsSection.style.display = 'block';
        videoSettingsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // ===== Utilities =====
    function formatFileSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    function formatDuration(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
})();
