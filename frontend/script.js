document.addEventListener('DOMContentLoaded', () => {

    // --- DOM ELEMENTS ---
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const viewLanding = document.getElementById('view-landing');
    const viewLoading = document.getElementById('view-loading');
    const viewEditor = document.getElementById('view-editor');
    const terminalLogs = document.getElementById('terminalLogs');
    const progressFill = document.getElementById('progressFill');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const btnClose = document.getElementById('btnClose');
    const btnDeploy = document.getElementById('btnDeploy');

    // --- AUTOMATED TECH STACK ANIMATION ---
    function animateTechStack() {
        const steps = [
            document.getElementById('tech-step-0'),
            document.getElementById('tech-step-1'),
            document.getElementById('tech-step-2'),
            document.getElementById('tech-step-3')
        ];

        if (!steps[0]) return; // Guard clause if elements missing

        let cycle = 0;
        const runCycle = () => {
            steps.forEach(s => s.classList.remove('active-step'));
            setTimeout(() => steps[0]?.classList.add('active-step'), 100);
            setTimeout(() => steps[1]?.classList.add('active-step'), 1100);
            setTimeout(() => steps[2]?.classList.add('active-step'), 2100);
            setTimeout(() => steps[3]?.classList.add('active-step'), 3100);
        };

        runCycle();
        setInterval(runCycle, 4000);
    }

    animateTechStack();

    // --- UPLOAD LOGIC ---

    // 1. Click Listener
    uploadZone.addEventListener('click', () => {
        // Allow re-selecting the same file after back/forward or cancel
        fileInput.value = '';
        fileInput.click();
    });

    // 2. Drag & Drop Visuals
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-active');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-active');
    });

    // 3. Drop Handler
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-active');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    // 4. File Input Change Handler
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    let code="";
    let backendComplete = false;
    
    // --- MAIN PROCESS ---
    async function handleFile(file) {
        // ROBUST VALIDATION: Check Name OR Mime Type
        const fileName = file.name.toLowerCase();
        const validExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
        const validMimeTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

        const isExtensionValid = validExtensions.some(ext => fileName.endsWith(ext));
        const isMimeValid = validMimeTypes.includes(file.type);

        if (!isExtensionValid && !isMimeValid) {
            alert("SYSTEM ERROR: Invalid format.\nPlease upload a PDF or JPG file.");
            console.error("Rejected File:", file.name, file.type);
            return;
        }

        console.log("File Accepted:", file.name);

        // Update UI immediately
        if (fileNameDisplay) fileNameDisplay.innerText = file.name;

        // Hide Landing, Show Loading
        viewLanding.classList.add('hidden');
        viewLoading.classList.remove('hidden');

        // Scroll to top to ensure loading screen is seen
        window.scrollTo(0, 0);

        // Start terminal sequence immediately
        runTerminalSequence(file.name);

        // Process backend - THIS MUST COMPLETE BEFORE NAVIGATION
        try {
            const form = new FormData();
            form.append('file', file);
            form.append('filename', fileName);
           
            console.log("Sending request to backend...");
            const res = await fetch("http://localhost:3000/file", {
                method: "POST",
                body: form
            });
            
            // Parse JSON response first
            const data = await res.json();
            
            if (data.success && data.html) {
                code = data.html;
                console.log("Backend Response Received Successfully");
                localStorage.setItem('backendCode', code);
                
                // Only set Vercel URL if it exists
                if (data.vercel && data.vercel.deployUrl) {
                    localStorage.setItem('vercel-deploy', data.vercel.deployUrl);
                } else {
                    localStorage.setItem('vercel-deploy', '');
                }
                
                // Store GitHub info if available
                if (data.github && !data.github.error) {
                    localStorage.setItem('github-repo', data.github.repository || '');
                }
                
                backendComplete = true;
            } else {
                console.error("Backend returned error:", data.error || data.message);
                alert("Error: " + (data.error || "Failed to generate portfolio"));
                // Still mark as complete so UI can proceed
                backendComplete = true;
            }
        } catch (error) {
            console.error("Backend request failed:", error);
            alert("Network error: Unable to reach server. Please check if backend is running.");
            backendComplete = true; // Mark complete so user can go back
        }
    }

    function runTerminalSequence(filename) {
        const logs = [
            `> TARGET_FILE: ${filename} ACQUIRED`,
            `> UPLOAD_SPEED: 850mbps // SECURE_CHANNEL`,
            `> INITIALIZING OCR SUB-ROUTINE...`,
            `> [OCR] DETECTED: TEXT_LAYER_VALID`,
            `> [OCR] DETECTED: IMAGE_ASSETS`,
            `> CONNECTING TO GEMINI_1.5_PRO API...`,
            `> SENT: { context: "portfolio_gen", source: "blob" }`,
            `> AWAITING NEURAL RESPONSE...`,
            `> PARSING JSON STRUCTURE...`,
            `> ASSEMBLING DOM ELEMENTS...`,
            `> APPLYING "CYBER_DARK" THEME...`,
            `> SYSTEM READY.`
        ];

        let index = 0;
        if (terminalLogs) terminalLogs.innerHTML = '';

        const interval = setInterval(() => {
            if (index >= logs.length) {
                clearInterval(interval);
                // Wait for backend to complete before navigating
                checkBackendAndNavigate();
                return;
            }

            if (terminalLogs) {
                const p = document.createElement('div');
                p.style.margin = "4px 0";
                p.style.color = "#06b6d4";
                p.style.fontFamily = "monospace";
                p.innerText = logs[index];
                terminalLogs.appendChild(p);
                terminalLogs.scrollTop = terminalLogs.scrollHeight;
            }

            if (progressFill) {
                const pct = ((index + 1) / logs.length) * 100;
                progressFill.style.width = `${pct}%`;
            }

            index++;
        }, 1000);
    }

    function checkBackendAndNavigate() {
        // Check every 500ms if backend is complete
        const checkInterval = setInterval(() => {
            if (backendComplete) {
                clearInterval(checkInterval);
                
                // Add final message
                if (terminalLogs) {
                    const p = document.createElement('div');
                    p.style.margin = "4px 0";
                    p.style.color = "#10b981";
                    p.style.fontFamily = "monospace";
                    p.innerText = "> PORTFOLIO GENERATION COMPLETE!";
                    terminalLogs.appendChild(p);
                }
                
                // Navigate after brief delay
                setTimeout(() => {
                    revealEditor();
                }, 1000);
            }
        }, 500);
        
        // Safety timeout: navigate after 60 seconds regardless
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!backendComplete) {
                console.warn("Backend timeout - navigating anyway");
                backendComplete = true;
                revealEditor();
            }
        }, 60000);
    }

    function revealEditor() {
        window.location.href = 'viewer.html';
    }

    // --- ACTIONS ---
    function resetUploadState() {
        viewEditor.classList.add('hidden');
        viewLanding.classList.remove('hidden');
        fileInput.value = ''; // Reset input

        // Reset upload zone styling
        uploadZone.classList.remove('drag-active');

        // Clear terminal logs
        if (terminalLogs) terminalLogs.innerHTML = '';

        // Reset progress bar
        if (progressFill) progressFill.style.width = '0%';

        // Reset file name display
        if (fileNameDisplay) fileNameDisplay.innerText = 'file.pdf';

        // Reset code variable and backend flag
        code = '';
        backendComplete = false;

        // Scroll to top
        window.scrollTo(0, 0);
    }

    if (btnClose) {
        btnClose.addEventListener('click', () => {
            resetUploadState();
        });
    }

    // Handle browser back/forward cache restore
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            resetUploadState();
        }
    });

    if (btnDeploy) {
        btnDeploy.addEventListener('click', () => {
            const btnText = btnDeploy.querySelector('.btn-text');
            const originalText = btnText ? btnText.innerText : "DEPLOY";

            if (btnText) btnText.innerText = "DEPLOYING...";
            btnDeploy.style.opacity = 0.7;

            setTimeout(() => {
                alert("STATUS: DEPLOYMENT SUCCESSFUL\nURL: https://zapfolio-v2-user.vercel.app");
                if (btnText) btnText.innerText = originalText;
                btnDeploy.style.opacity = 1;
            }, 2000);
        });
    }
});