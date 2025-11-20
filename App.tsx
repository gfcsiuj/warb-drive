
import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/engine';
import { GameState, HUDState, GameSettings } from './types';
import { audioService } from './services/audioService';
import HUD from './components/HUD';
import UpgradeMenu from './components/UpgradeMenu';
import HandControl from './components/HandControl';
import SettingsMenu from './components/SettingsMenu';

const DEFAULT_SETTINGS: GameSettings = {
    circleRadius: 0.08, // Smaller by default (8% of width)
    sensitivity: 0.1,   // Default smoothing
    showCamera: true,
    highPerformance: false, // Default to 30fps for safety
    trackingMode: 'index' // Default to index finger tip
};

const App: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GameEngine | null>(null);
    const requestRef = useRef<number>(0);
    
    const [gameState, setGameState] = useState<GameState>(GameState.MENU);
    const [hudState, setHudState] = useState<HUDState | null>(null);
    const [finalScore, setFinalScore] = useState(0);
    
    const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);

    // Loading / System State
    const [isSystemReady, setSystemReady] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState("BOOT SEQUENCE INITIATED...");

    // Input Handling
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!engineRef.current) return;
            const k = e.code;
            const keys = engineRef.current.keys;
            
            if (k === 'KeyW' || k === 'ArrowUp') keys.w = true;
            if (k === 'KeyA' || k === 'ArrowLeft') keys.a = true;
            if (k === 'KeyS' || k === 'ArrowDown') keys.s = true;
            if (k === 'KeyD' || k === 'ArrowRight') keys.d = true;
            
            if (gameState === GameState.PLAYING) {
                if (k === 'Space') engineRef.current.triggerDash();
                if (k === 'KeyQ') engineRef.current.player.activateShield();
                if (k === 'KeyE') engineRef.current.triggerNuke();
            }
            
            // Esc to pause or open menu could be added here
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (!engineRef.current) return;
            const k = e.code;
            const keys = engineRef.current.keys;
            if (k === 'KeyW' || k === 'ArrowUp') keys.w = false;
            if (k === 'KeyA' || k === 'ArrowLeft') keys.a = false;
            if (k === 'KeyS' || k === 'ArrowDown') keys.s = false;
            if (k === 'KeyD' || k === 'ArrowRight') keys.d = false;
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!engineRef.current) return;
            engineRef.current.mouse.x = e.clientX;
            engineRef.current.mouse.y = e.clientY;
        };

        const handleMouseDown = () => {
            if (engineRef.current) engineRef.current.mouse.down = true;
        };

        const handleMouseUp = () => {
            if (engineRef.current) engineRef.current.mouse.down = false;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [gameState]);

    // Game Loop
    const loop = () => {
        if (gameState === GameState.PLAYING && canvasRef.current && engineRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                // Resize if needed
                if (canvasRef.current.width !== window.innerWidth || canvasRef.current.height !== window.innerHeight) {
                    canvasRef.current.width = window.innerWidth;
                    canvasRef.current.height = window.innerHeight;
                }
                
                const newState = engineRef.current.update(canvasRef.current.width, canvasRef.current.height);
                engineRef.current.draw(ctx, canvasRef.current.width, canvasRef.current.height);
                
                setHudState(newState);
            }
        }
        requestRef.current = requestAnimationFrame(loop);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(loop);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    });

    const startGame = () => {
        audioService.resume();
        engineRef.current = new GameEngine(
            () => setGameState(GameState.PAUSED),
            (score) => {
                setFinalScore(score);
                setGameState(GameState.GAMEOVER);
            }
        );
        setGameState(GameState.PLAYING);
    };

    return (
        <div className="w-screen h-screen bg-black relative overflow-hidden">
            <canvas ref={canvasRef} className="block" />

            {/* Hand Control System - Passed settings */}
            <HandControl 
                gameEngine={engineRef.current} 
                settings={settings}
                onInitStatus={(msg, ready) => {
                    setLoadingStatus(msg);
                    if (ready) {
                        setTimeout(() => setSystemReady(true), 800);
                    }
                }}
            />

            {/* BOOT LOADING SCREEN */}
            {!isSystemReady && (
                <div className="absolute inset-0 z-[100] bg-black flex flex-col items-center justify-center text-center p-8">
                    <div className="w-24 h-24 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-8 shadow-[0_0_30px_rgba(0,210,255,0.4)]"></div>
                    <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-widest">WARP DRIVE</h1>
                    <div className="font-mono text-cyan-400 text-lg md:text-xl tracking-[0.2em] animate-pulse uppercase">
                        {loadingStatus}
                    </div>
                    <div className="mt-8 text-gray-600 text-xs max-w-md">
                        INITIALIZING NEURAL INTERFACE. PLEASE ALLOW CAMERA ACCESS.
                    </div>
                </div>
            )}

            {/* HUD */}
            {gameState === GameState.PLAYING && hudState && isSystemReady && (
                <HUD state={hudState} gameEngine={engineRef.current} />
            )}

            {/* Main Menu */}
            {gameState === GameState.MENU && isSystemReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md z-50 animate-in fade-in zoom-in duration-500">
                    <h1 className="text-7xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-cyan-400 mb-2 drop-shadow-[0_0_30px_rgba(0,210,255,0.6)] tracking-tighter">
                        WARP DRIVE
                    </h1>
                    <h2 className="text-cyan-400 text-xl md:text-2xl tracking-[0.3em] font-light mb-12">ULTIMATE EDITION</h2>
                    
                    <div className="text-gray-500 text-center mb-10 space-y-2">
                        <p>WASD to Move • Mouse or Hand to Aim</p>
                        <div className="flex items-center justify-center gap-2 text-cyan-500 font-bold mt-4 bg-cyan-950/30 px-4 py-2 rounded-full border border-cyan-900/50">
                            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
                            HAND CONTROLS ACTIVE
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button 
                            onClick={startGame}
                            className="px-12 py-4 bg-cyan-400 text-black text-2xl font-bold rounded-full hover:bg-white hover:scale-110 transition-all duration-200 shadow-[0_0_20px_rgba(0,210,255,0.5)]"
                        >
                            INITIATE LAUNCH
                        </button>
                        
                        <button 
                            onClick={() => setGameState(GameState.SETTINGS)}
                            className="w-16 h-16 flex items-center justify-center bg-gray-800 border border-gray-600 rounded-full hover:bg-gray-700 hover:border-cyan-400 transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="white" className="w-8 h-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.212 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Settings Menu */}
            {gameState === GameState.SETTINGS && (
                <SettingsMenu 
                    settings={settings} 
                    onUpdate={setSettings} 
                    onClose={() => setGameState(GameState.MENU)} 
                />
            )}

            {/* Upgrade Menu */}
            {gameState === GameState.PAUSED && engineRef.current && (
                <UpgradeMenu 
                    player={engineRef.current.player} 
                    onSelect={(u) => {
                        u.apply(engineRef.current!.player);
                        setGameState(GameState.PLAYING);
                    }} 
                />
            )}

            {/* Game Over */}
            {gameState === GameState.GAMEOVER && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/90 backdrop-blur-md z-50 animate-in fade-in duration-500">
                    <h1 className="text-6xl md:text-8xl font-black text-red-500 mb-4 drop-shadow-[0_0_30px_rgba(255,0,0,0.6)]">
                        CRITICAL FAILURE
                    </h1>
                    <div className="text-4xl text-white mb-12 font-bold">
                        FINAL SCORE: <span className="text-red-400">{finalScore}</span>
                    </div>
                    <button 
                        onClick={startGame}
                        className="px-10 py-3 bg-red-500 text-black text-xl font-bold rounded-full hover:bg-white hover:scale-105 transition-all duration-200 shadow-[0_0_20px_rgba(255,0,0,0.5)]"
                    >
                        REBOOT SYSTEM
                    </button>
                </div>
            )}
        </div>
    );
};

export default App;
