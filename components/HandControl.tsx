
import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';
import { GameEngine } from '../game/engine';
import { GameSettings } from '../types';

interface Props {
    gameEngine: GameEngine | null;
    onInitStatus?: (message: string, isReady: boolean) => void;
    settings: GameSettings;
}

// Constants for Zones (Visual Coordinates: 0 is Left, 1 is Right)
const MOVE_ZONE_CENTER = { x: 0.5, y: 0.5 }; 

// Helper for smooth movement
const lerp = (start: number, end: number, t: number) => {
    return start * (1 - t) + end * t;
};

// Optimized Squared Distance for gestures (avoid sqrt)
const distSq = (p1: any, p2: any) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return dx*dx + dy*dy;
};

const HandControl: React.FC<Props> = ({ gameEngine, onInitStatus, settings }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string>('');
    const [isConnecting, setIsConnecting] = useState(true);
    
    // UI State for Visual Feedback
    const [isMoving, setIsMoving] = useState(false);
    const [isFiring, setIsFiring] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string>('');
    
    const landmarkerRef = useRef<HandLandmarker | null>(null);
    const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
    
    const requestRef = useRef<number>(0);
    const lastVideoTimeRef = useRef<number>(-1);
    const lastPredictionTimeRef = useRef<number>(0);
    
    const engineRef = useRef<GameEngine | null>(gameEngine);
    const settingsRef = useRef<GameSettings>(settings);
    const targetMouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

    // Debounce for special actions to prevent spamming
    const lastDashRef = useRef(0);
    const lastNukeRef = useRef(0);
    const lastShieldRef = useRef(0);

    // Update Refs when props change
    useEffect(() => {
        engineRef.current = gameEngine;
    }, [gameEngine]);

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    useEffect(() => {
        let stream: MediaStream | null = null;

        const setup = async () => {
            try {
                if (onInitStatus) onInitStatus("INITIALIZING VISION CORE...", false);

                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
                );
                
                if (onInitStatus) onInitStatus("LOADING MODELS...", false);

                // Load Hand Model
                const landmarker = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numHands: 2,
                    minHandDetectionConfidence: 0.5,
                    minHandPresenceConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });
                landmarkerRef.current = landmarker;

                // Load Face Model (for blinking)
                const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numFaces: 1,
                    minFaceDetectionConfidence: 0.5,
                    minFacePresenceConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                    outputFaceBlendshapes: true
                });
                faceLandmarkerRef.current = faceLandmarker;

                if (onInitStatus) onInitStatus("ESTABLISHING NEURAL LINK...", false);

                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        width: { ideal: 320 },
                        height: { ideal: 240 },
                        frameRate: { ideal: 30 } 
                    } 
                });
                
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    
                    videoRef.current.onloadeddata = () => {
                        if (videoRef.current) {
                            videoRef.current.play().then(() => {
                                setIsConnecting(false);
                                if (onInitStatus) onInitStatus("SYSTEMS ONLINE", true);
                                predict();
                            }).catch(e => {
                                console.error("Play error", e);
                                setError("CAMERA PLAYBACK FAILED");
                            });
                        }
                    };
                }

            } catch (err: any) {
                console.error("HandControl Error:", err);
                const errMsg = "INIT FAILED: " + (err.message || "Camera Error");
                setError(errMsg);
                if (onInitStatus) onInitStatus(errMsg, false);
            }
        };

        setup();

        return () => {
            if (stream) stream.getTracks().forEach(t => t.stop());
            if (landmarkerRef.current) landmarkerRef.current.close();
            if (faceLandmarkerRef.current) faceLandmarkerRef.current.close();
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    const predict = () => {
        requestRef.current = requestAnimationFrame(predict);

        if (!landmarkerRef.current || !faceLandmarkerRef.current || !videoRef.current || !canvasRef.current) return;

        const currentSettings = settingsRef.current;
        const now = performance.now();
        
        // Performance Throttling based on current settings
        const minInterval = currentSettings.highPerformance ? 16 : 33; 
        
        if (now - lastPredictionTimeRef.current < minInterval) return;
        lastPredictionTimeRef.current = now;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        if (video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime;
            
            const handResults = landmarkerRef.current.detectForVideo(video, now);
            const faceResults = faceLandmarkerRef.current.detectForVideo(video, now);

            // OPTIMIZATION: Skip clearing and drawing if camera is hidden
            if (currentSettings.showCamera) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }

            // Reset Inputs
            let moving = false;
            let firing = false;
            let activeMessage = '';
            
            // Logic states
            let leftFist = false;
            let rightFist = false;

            if (engineRef.current) {
                const k = engineRef.current.keys;
                k.w = false; k.a = false; k.s = false; k.d = false;
                engineRef.current.player.setBoost(false);
            }

            // --- FACE LOGIC (DASH) ---
            if (faceResults.faceBlendshapes && faceResults.faceBlendshapes.length > 0) {
                const categories = faceResults.faceBlendshapes[0].categories;
                const eyeBlinkLeft = categories.find(c => c.categoryName === 'eyeBlinkLeft')?.score || 0;
                const eyeBlinkRight = categories.find(c => c.categoryName === 'eyeBlinkRight')?.score || 0;

                if (eyeBlinkLeft > 0.6 && eyeBlinkRight > 0.6) {
                    activeMessage = "EYES CLOSED - DASH";
                    if (engineRef.current && now - lastDashRef.current > 1000) {
                        engineRef.current.triggerDash();
                        lastDashRef.current = now;
                    }
                }
            }

            // --- HAND LOGIC ---
            if (handResults.landmarks && handResults.landmarks.length > 0) {
                for (let i = 0; i < handResults.landmarks.length; i++) {
                    const landmarks = handResults.landmarks[i];
                    const handedness = handResults.handedness[i][0];
                    const category = handedness.categoryName; // "Left" or "Right" (MediaPipe is usually mirrored)
                    const wrist = landmarks[0];

                    // Helpers
                    const isCurled = (idx: number) => distSq(landmarks[idx], wrist) < 0.03;
                    
                    // Detect Fist (All fingers curled)
                    const isFist = isCurled(8) && isCurled(12) && isCurled(16) && isCurled(20);
                    if (category === 'Left' && isFist) leftFist = true;
                    if (category === 'Right' && isFist) rightFist = true;

                    // --- RIGHT HAND: Move & Aim ---
                    if (category === 'Right' && engineRef.current) {
                        const trackIdx = currentSettings.trackingMode === 'index' ? 8 : 0;
                        const trackPoint = landmarks[trackIdx];
                        const visualX = 1 - trackPoint.x; 
                        const visualY = trackPoint.y;

                        const dx = visualX - MOVE_ZONE_CENTER.x;
                        const dy = visualY - MOVE_ZONE_CENTER.y;
                        const distance = Math.sqrt(dx*dx + dy*dy);

                        if (distance > currentSettings.circleRadius) {
                            moving = true;
                            const THRESHOLD = 0.02;
                            if (dy < -THRESHOLD) engineRef.current.keys.w = true; 
                            if (dy > THRESHOLD) engineRef.current.keys.s = true; 
                            if (dx < -THRESHOLD) engineRef.current.keys.a = true; 
                            if (dx > THRESHOLD) engineRef.current.keys.d = true;

                            // Auto Aim
                            const nx = dx / distance;
                            const ny = dy / distance;
                            const aimDistance = 400;
                            targetMouseRef.current.x = (window.innerWidth / 2) + (nx * aimDistance);
                            targetMouseRef.current.y = (window.innerHeight / 2) + (ny * aimDistance);
                        }

                        // Boost on Fist (Right hand only)
                        if (isFist) {
                            engineRef.current.player.setBoost(true);
                        }

                        // Visuals
                        if (currentSettings.showCamera) {
                            const cx = trackPoint.x * canvas.width;
                            const cy = trackPoint.y * canvas.height;
                            
                            ctx.beginPath();
                            ctx.arc(cx, cy, 6, 0, Math.PI * 2);
                            ctx.fillStyle = moving ? '#ffaa00' : 'rgba(255, 255, 255, 0.5)';
                            ctx.fill();

                            if (moving) {
                                const zoneRawX = 1 - MOVE_ZONE_CENTER.x;
                                const zoneCenterX = zoneRawX * canvas.width;
                                const zoneCenterY = MOVE_ZONE_CENTER.y * canvas.height;
                                ctx.beginPath(); ctx.moveTo(zoneCenterX, zoneCenterY); ctx.lineTo(cx, cy);
                                ctx.strokeStyle = 'rgba(255, 170, 0, 0.6)';
                                ctx.lineWidth = 2; ctx.stroke();
                            }
                        }
                    }

                    // --- LEFT HAND: Fire & Shield (Back of hand) ---
                    if (category === 'Left' && engineRef.current) {
                        // Fire on Fist (simultaneous with boost logic for logic consistency)
                        if (isFist) {
                            engineRef.current.mouse.down = true;
                            firing = true;
                        }

                        // SHIELD: Detect "Back of Hand"
                        // Normal "Palm Open" Left Hand facing camera: Thumb (4) is to the RIGHT of Pinky (20) (Higher X)
                        // "Back of Hand" Facing camera: Thumb (4) is to the LEFT of Pinky (20) (Lower X)
                        // Note: MediaPipe X is 0..1 from Left to Right.
                        // Let's verify:
                        // User Left Hand, Palm to Cam: [Pinky] .. [Thumb] -> Pinky.x < Thumb.x
                        // User Left Hand, Back to Cam: [Thumb] .. [Pinky] -> Thumb.x < Pinky.x
                        const thumbX = landmarks[4].x;
                        const pinkyX = landmarks[20].x;
                        const isBackOfHand = thumbX < pinkyX;

                        if (isBackOfHand && !leftFist) { // Don't shield if trying to fist/nuke
                             activeMessage = "BACKHAND - SHIELD";
                             if (now - lastShieldRef.current > 1000) {
                                 engineRef.current.triggerShield();
                                 lastShieldRef.current = now;
                             }
                        }

                        if (currentSettings.showCamera) {
                            const cx = landmarks[8].x * canvas.width;
                            const cy = landmarks[8].y * canvas.height;
                            if (isBackOfHand && !isFist) {
                                ctx.fillStyle = 'cyan';
                                ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI*2); ctx.fill();
                            }
                        }
                    }
                }
            } else {
                if (engineRef.current) engineRef.current.mouse.down = false;
            }

            // --- NUKE (DUAL FIST) ---
            if (leftFist && rightFist) {
                activeMessage = "DUAL CORE - NUKE";
                if (engineRef.current && now - lastNukeRef.current > 2000) {
                    engineRef.current.triggerNuke();
                    lastNukeRef.current = now;
                }
            }

            setStatusMessage(activeMessage);
            setIsMoving(moving);
            setIsFiring(firing);
        }

        if (engineRef.current) {
            engineRef.current.mouse.x = lerp(engineRef.current.mouse.x, targetMouseRef.current.x, currentSettings.sensitivity);
            engineRef.current.mouse.y = lerp(engineRef.current.mouse.y, targetMouseRef.current.y, currentSettings.sensitivity);
        }
    };

    return (
        <div 
            className={`absolute bottom-4 right-4 w-[240px] h-[180px] rounded-xl overflow-hidden bg-black/90 shadow-[0_0_30px_rgba(0,210,255,0.2)] z-40 transition-all duration-500 border border-gray-800 ${settings.showCamera ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
            {error && <div className="absolute inset-0 flex items-center justify-center text-red-500 text-xs p-2 text-center font-bold bg-black/90 z-50">{error}</div>}
            
            {isConnecting && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
                    <div className="text-[10px] text-cyan-400 font-mono animate-pulse">CONNECTING...</div>
                </div>
            )}

            <div className="relative w-full h-full" style={{ transform: 'scaleX(-1)' }}>
                <video 
                    ref={videoRef} 
                    className="absolute inset-0 w-full h-full object-cover opacity-40"
                    playsInline 
                    muted 
                    autoPlay
                />
                <canvas 
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    width={320}
                    height={240}
                />
                
                {/* Movement Guide Circle */}
                <div 
                    className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center pointer-events-none transition-all duration-200 ${isMoving ? 'border-orange-400 bg-orange-500/20 shadow-[0_0_15px_rgba(255,165,0,0.5)]' : 'border-orange-500/30'}`}
                    style={{ 
                        width: `${settings.circleRadius * 200}%`, 
                        height: `${settings.circleRadius * 200 * (320/240)}%`, 
                        borderWidth: '2px'
                    }}
                >
                    <div className="w-1 h-1 bg-orange-500 rounded-full opacity-50"></div>
                </div>
            </div>
            
            <div className="absolute top-0 left-0 w-full bg-gradient-to-b from-black/80 to-transparent px-3 py-1 flex justify-between items-center">
                <div className="text-[8px] font-bold text-cyan-400 tracking-widest">NEURAL LINK</div>
                <div className={`w-2 h-2 rounded-full ${isConnecting ? 'bg-red-500' : 'bg-green-500'} animate-pulse`}></div>
            </div>
            
            {/* Gestures Status Overlay */}
            {statusMessage && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none z-50">
                    <div className="text-xs font-black text-white bg-red-600/80 px-2 py-1 rounded animate-pulse whitespace-nowrap">
                        {statusMessage}
                    </div>
                </div>
            )}
            
            <div className="absolute bottom-1 left-0 w-full flex justify-between px-4 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                <span className={isFiring ? 'text-red-400' : ''}>Fire</span>
                <span className={isMoving ? 'text-orange-400' : ''}>Move</span>
            </div>
        </div>
    );
};

export default HandControl;
