
import React from 'react';
import { GameSettings } from '../types';

interface Props {
    settings: GameSettings;
    onUpdate: (s: GameSettings) => void;
    onClose: () => void;
}

const SettingsMenu: React.FC<Props> = ({ settings, onUpdate, onClose }) => {
    
    const handleChange = (key: keyof GameSettings, value: any) => {
        onUpdate({ ...settings, [key]: value });
    };

    return (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in zoom-in duration-300">
            <div className="w-full max-w-md p-8 border border-gray-800 bg-gray-900/80 rounded-2xl shadow-[0_0_50px_rgba(0,210,255,0.15)]">
                <h2 className="text-3xl font-black text-white mb-8 tracking-widest border-b border-gray-700 pb-4">
                    SYSTEM CONFIG
                </h2>

                <div className="space-y-6">
                    {/* Radius Slider */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-cyan-400 uppercase">
                            <span>Control Zone Size</span>
                            <span>{Math.round(settings.circleRadius * 100)}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0.05" 
                            max="0.25" 
                            step="0.01"
                            value={settings.circleRadius}
                            onChange={(e) => handleChange('circleRadius', parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300"
                        />
                        <p className="text-[10px] text-gray-500">Adjusts the size of the orange movement circle.</p>
                    </div>

                    {/* Sensitivity Slider */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-orange-400 uppercase">
                            <span>Aim Sensitivity</span>
                            <span>{Math.round(settings.sensitivity * 100)}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0.01" 
                            max="0.5" 
                            step="0.01"
                            value={settings.sensitivity}
                            onChange={(e) => handleChange('sensitivity', parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-400 hover:accent-orange-300"
                        />
                        <p className="text-[10px] text-gray-500">Controls how fast the cursor follows your hand.</p>
                    </div>

                    {/* Tracking Mode */}
                    <div className="space-y-2 pt-2 border-t border-gray-800">
                        <span className="text-xs font-bold text-purple-400 uppercase">Movement Tracking Source</span>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => handleChange('trackingMode', 'index')}
                                className={`flex-1 py-2 rounded text-xs font-bold transition-all ${settings.trackingMode === 'index' ? 'bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}
                            >
                                INDEX FINGER (TIP)
                            </button>
                            <button 
                                onClick={() => handleChange('trackingMode', 'wrist')}
                                className={`flex-1 py-2 rounded text-xs font-bold transition-all ${settings.trackingMode === 'wrist' ? 'bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}
                            >
                                WRIST (WHOLE HAND)
                            </button>
                        </div>
                    </div>

                    {/* Toggles */}
                    <div className="flex justify-between items-center pt-2">
                        <span className="text-sm font-bold text-gray-300">Show Camera HUD</span>
                        <button 
                            onClick={() => handleChange('showCamera', !settings.showCamera)}
                            className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ${settings.showCamera ? 'bg-cyan-500' : 'bg-gray-700'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${settings.showCamera ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-gray-300">High Performance (60 FPS)</span>
                        <button 
                            onClick={() => handleChange('highPerformance', !settings.highPerformance)}
                            className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ${settings.highPerformance ? 'bg-green-500' : 'bg-gray-700'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${settings.highPerformance ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                    </div>
                </div>

                <button 
                    onClick={onClose}
                    className="w-full mt-8 py-3 bg-white text-black font-bold rounded-lg hover:bg-cyan-400 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                >
                    RESUME
                </button>
            </div>
        </div>
    );
};

export default SettingsMenu;
