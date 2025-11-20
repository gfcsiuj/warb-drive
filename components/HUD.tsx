import React, { useEffect, useRef } from 'react';
import { HUDState } from '../types';

interface HUDProps {
    state: HUDState;
    gameEngine: any;
}

const HUD: React.FC<HUDProps> = ({ state, gameEngine }) => {
    const miniMapRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (miniMapRef.current && gameEngine) {
            const ctx = miniMapRef.current.getContext('2d');
            if (ctx) {
                gameEngine.drawMinimap(ctx);
            }
        }
    });

    const getPct = (curr: number, max: number) => Math.min(100, Math.max(0, (curr / max) * 100));

    return (
        <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
            {/* Top Bar */}
            <div className="flex w-full justify-between items-start">
                <div className="bg-gray-900/80 border border-cyan-400/50 rounded-lg p-3 min-w-[120px] text-center backdrop-blur-sm">
                    <div className="text-xs text-gray-400 uppercase tracking-wider">Health</div>
                    <div className={`text-3xl font-black ${state.shieldHp > 0 ? 'text-cyan-400' : 'text-green-400'}`}>
                        {Math.floor(state.hp + state.shieldHp)}%
                    </div>
                </div>

                {/* XP Bar */}
                <div className="absolute left-1/2 -translate-x-1/2 top-4 w-1/3 h-4 bg-gray-800 rounded-full border border-gray-600 overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-orange-400 to-yellow-300 transition-all duration-200"
                        style={{ width: `${getPct(state.xp, state.maxXp)}%` }}
                    />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-orange-500 text-black w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 border-white text-sm shadow-lg mt-4">
                        {state.level}
                    </div>
                </div>

                <div className="bg-gray-900/80 border border-cyan-400/50 rounded-lg p-3 min-w-[120px] text-center backdrop-blur-sm">
                    <div className="text-xs text-gray-400 uppercase tracking-wider">Score</div>
                    <div className="text-3xl font-black text-white">{state.score}</div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="flex w-full justify-between items-end">
                {/* Skills */}
                <div className="flex gap-4">
                    <SkillSlot k="SPACE" label="DASH" cd={state.dashCd} max={state.maxDashCd} />
                    <SkillSlot k="Q" label="SHIELD" cd={state.shieldCd} max={state.maxShieldCd} />
                    <SkillSlot k="E" label="NUKE" cd={state.nukeCd} max={state.maxNukeCd} />
                </div>

                {/* Minimap */}
                <div className="w-[150px] h-[150px] rounded-full border-2 border-cyan-500 overflow-hidden shadow-[0_0_20px_rgba(0,210,255,0.3)] bg-black/80">
                    <canvas ref={miniMapRef} width={150} height={150} className="w-full h-full" />
                </div>
            </div>
        </div>
    );
};

const SkillSlot = ({ k, label, cd, max }: { k: string, label: string, cd: number, max: number }) => {
    const pct = (cd / max) * 100;
    return (
        <div className="w-16 h-16 bg-black/80 border-2 border-gray-700 rounded-lg relative flex flex-col items-center justify-center overflow-hidden">
            <div className="absolute top-0 inset-x-0 bg-white text-black text-[10px] font-bold text-center px-1">
                {k}
            </div>
            <div className="text-[10px] text-gray-400 mt-2">{label}</div>
            {cd > 0 && (
                <div 
                    className="absolute bottom-0 left-0 w-full bg-cyan-500/50 transition-all duration-75 ease-linear"
                    style={{ height: `${pct}%` }}
                />
            )}
        </div>
    );
};

export default HUD;