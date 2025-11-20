
import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
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

const HandControl: React.FC<Props> = ({ gameEngine, onInitStatus, settings }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string>('');
    const [isConnecting, setIsConnecting] = useState(true);
    
    // UI State for Visual Feedback
    const [isMoving, setIsMoving] = useState(false);
    const [isFiring, setIsFiring] = useState(false);
    
    const landmarkerRef = useRef<HandLandmarker | null>(null);
    const requestRef = useRef<number>(0);
    const lastVideoTimeRef = useRef<number>(-1);
    const lastPredictionTimeRef = useRef<number>(0);
    
    const engineRef = useRef<GameEngine | null>(gameEngine);
    const settingsRef = useRef<GameSettings>(settings);
    const targetMouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

    // Update Refs when props change to avoid stale closures in the loop
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
                if (onInitStatus) onInitStatus("INITIALIZING NEURAL CORE...", false);

                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
                );
                
                if (onInitStatus) onInitStatus("LOADING VISION MODELS...", false);

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

                if (onInitStatus) onInitStatus("ESTABLISHING OPTICAL LINK...", false);

                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        width: { ideal: 320 },
                        height: { ideal: 240 },
                        frameRate: { ideal: 30 } // Request 30, but we might process at 60 if configured
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
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    const predict = () => {
        requestRef.current = requestAnimationFrame(predict);

        if (!landmarkerRef.current || !videoRef.current || !canvasRef.current) return;

        const currentSettings = settingsRef.current;
        const now = performance.now();
        
        // Performance Throttling based on current settings
        const minInterval = currentSettings.highPerformance ? 16 : 33; // ~60fps vs ~30fps
        
        if (now - lastPredictionTimeRef.current < minInterval) return;
        lastPredictionTimeRef.current = now;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        if (video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime;
            const results = landmarkerRef.current.detectForVideo(video, now);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Reset Inputs
            let moving = false;
            let firing = false;
            if (engineRef.current) {
                const k = engineRef.current.keys;
                k.w = false; k.a = false; k.s = false; k.d = false;
            }

            if (results.landmarks && results.landmarks.length > 0) {
                for (let i = 0; i < results.landmarks.length; i++) {
                    const landmarks = results.landmarks[i];
                    const handedness = results.handedness[i][0];
                    const category = handedness.categoryName; // "Left" or "Right"

                    // --- RIGHT HAND (Visual Right): MOVE & AUTO AIM ---
                    if (category === 'Right' && engineRef.current) {
                        
                        // Determine Tracking Point based on Settings
                        // Index Tip is 8, Wrist is 0
                        const trackIdx = currentSettings.trackingMode === 'index' ? 8 : 0;
                        const trackPoint = landmarks[trackIdx];
                        const wrist = landmarks[0]; // Keep wrist for visuals drawing anchor if needed

                        // Visual Coordinates (0=Left, 1=Right)
                        const visualX = 1 - trackPoint.x; 
                        const visualY = trackPoint.y;

                        // Calculate distance from the CENTERED Zone (0.5, 0.5)
                        const dx = visualX - MOVE_ZONE_CENTER.x;
                        const dy = visualY - MOVE_ZONE_CENTER.y;
                        const distance = Math.sqrt(dx*dx + dy*dy);

                        // RADIAL JOYSTICK LOGIC using DYNAMIC SETTINGS
                        if (distance > currentSettings.circleRadius) {
                            moving = true;
                            
                            // Normalize vector
                            const nx = dx / distance;
                            const ny = dy / distance;

                            const THRESHOLD = 0.02;
                            // Set Keys based on direction
                            if (dy < -THRESHOLD) engineRef.current.keys.w = true; 
                            if (dy > THRESHOLD) engineRef.current.keys.s = true; 
                            if (dx < -THRESHOLD) engineRef.current.keys.a = true; 
                            if (dx > THRESHOLD) engineRef.current.keys.d = true;

                            // --- AUTO AIM LOGIC ---
                            const aimDistance = 400;
                            targetMouseRef.current.x = (window.innerWidth / 2) + (nx * aimDistance);
                            targetMouseRef.current.y = (window.innerHeight / 2) + (ny * aimDistance);
                        }

                        // Draw Feedback (Only if camera is enabled in logic, visuals hidden via CSS if toggled)
                        if (currentSettings.showCamera) {
                            const cx = trackPoint.x * canvas.width;
                            const cy = trackPoint.y * canvas.height;
                            
                            // Draw Hand Point
                            ctx.beginPath();
                            ctx.arc(cx, cy, 6, 0, Math.PI * 2);
                            ctx.fillStyle = moving ? '#ffaa00' : 'rgba(255, 255, 255, 0.5)';
                            ctx.fill();

                            // Draw tether line if moving
                            if (moving) {
                                const zoneRawX = 1 - MOVE_ZONE_CENTER.x;
                                const zoneCenterX = zoneRawX * canvas.width;
                                const zoneCenterY = MOVE_ZONE_CENTER.y * canvas.height;
                                
                                ctx.beginPath();
                                ctx.moveTo(zoneCenterX, zoneCenterY);
                                ctx.lineTo(cx, cy);
                                ctx.strokeStyle = 'rgba(255, 170, 0, 0.6)';
                                ctx.lineWidth = 2;
                                ctx.stroke();
                            }
                        }
                    }

                    // --- LEFT HAND (Visual Left): FIRE TRIGGER ---
                    if (category === 'Left' && engineRef.current) {
                         const wrist = landmarks[0];
                         const isClosed = (idx: number) => {
                             const dx = landmarks[idx].x - wrist.x;
                             const dy = landmarks[idx].y - wrist.y;
                             return (dx*dx + dy*dy) < 0.03; 
                         };
                         const clench = isClosed(12) && isClosed(16) && isClosed(20);
                         engineRef.current.mouse.down = clench;
                         if (clench) firing = true;

                         if (currentSettings.showCamera) {
                             const cx = landmarks[8].x * canvas.width;
                             const cy = landmarks[8].y * canvas.height;

                             if (clench) {
                                 ctx.strokeStyle = '#ff0000';
                                 ctx.lineWidth = 4;
                                 ctx.beginPath();
                                 ctx.arc(cx, cy, 15, 0, Math.PI*2);
                                 ctx.stroke();
                                 ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                                 ctx.fill();
                             } else {
                                 ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
                                 ctx.lineWidth = 1;
                                 ctx.beginPath();
                                 ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);
                                 ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
                                 ctx.stroke();
                             }
                         }
                    }
                }
            } else {
                if (engineRef.current) engineRef.current.mouse.down = false;
            }
            
            setIsMoving(moving);
            setIsFiring(firing);
        }

        if (engineRef.current) {
            // Apply Dynamic Sensitivity from Ref
            engineRef.current.mouse.x = lerp(engineRef.current.mouse.x, targetMouseRef.current.x, currentSettings.sensitivity);
            engineRef.current.mouse.y = lerp(engineRef.current.mouse.y, targetMouseRef.current.y, currentSettings.sensitivity);
        }
    };

    return (
        <div 
            className={`absolute bottom-4 right-4 w-[240px] h-[180px] rounded-xl overflow-hidden bg-black/90 shadow-[0_0_30px_rgba(0,210,255,0.2)] z-40 transition-all duration-500 border border-gray-800 ${settings.showCamera ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
            {/* Error Message */}
            {error && <div className="absolute inset-0 flex items-center justify-center text-red-500 text-xs p-2 text-center font-bold bg-black/90 z-50">{error}</div>}
            
            {/* Connecting */}
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
                
                {/* DYNAMIC VISUAL ZONES */}
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
            
            {/* HUD Labels */}
            <div className="absolute top-0 left-0 w-full bg-gradient-to-b from-black/80 to-transparent px-3 py-1 flex justify-between items-center">
                <div className="text-[8px] font-bold text-cyan-400 tracking-widest">NEURAL LINK</div>
                <div className={`w-2 h-2 rounded-full ${isConnecting ? 'bg-red-500' : 'bg-green-500'} animate-pulse`}></div>
            </div>
            
            <div className="absolute bottom-1 left-0 w-full flex justify-between px-4 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                <span className={isFiring ? 'text-red-400' : ''}>Fire</span>
                <span className={isMoving ? 'text-orange-400' : ''}>Move</span>
            </div>
        </div>
    );
};

export default HandControl;
