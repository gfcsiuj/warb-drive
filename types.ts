
export enum GameState {
    MENU = 'MENU',
    PLAYING = 'PLAYING',
    PAUSED = 'PAUSED', // For upgrades
    SETTINGS = 'SETTINGS',
    GAMEOVER = 'GAMEOVER'
}

export interface GameSettings {
    circleRadius: number; // 0.05 to 0.3
    sensitivity: number; // 0.01 to 0.5 (Lerp factor)
    showCamera: boolean;
    highPerformance: boolean; // true = 60fps, false = 30fps
    trackingMode: 'index' | 'wrist'; // 'index' (Tip) or 'wrist' (Whole Hand)
}

export interface Upgrade {
    id: string;
    title: string;
    description: string;
    rarity: 'Common' | 'Rare' | 'Legendary';
    apply: (player: any) => void;
}

export interface HUDState {
    hp: number;
    maxHp: number;
    shieldHp: number;
    score: number;
    level: number;
    xp: number;
    maxXp: number;
    dashCd: number;
    maxDashCd: number;
    shieldCd: number;
    maxShieldCd: number;
    nukeCd: number;
    maxNukeCd: number;
}

export interface Point {
    x: number;
    y: number;
}

export interface AudioService {
    playTone: (freq: number, type: OscillatorType, duration: number, vol?: number) => void;
    resume: () => void;
}
