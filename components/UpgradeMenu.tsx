import React, { useEffect, useState } from 'react';
import { Upgrade } from '../types';

interface Props {
    onSelect: (u: Upgrade) => void;
    player: any; // Access to modify player stats directly
}

const UPGRADES_LIST: Omit<Upgrade, 'apply'>[] = [
    { id: 'dmg', title: 'Plasma Core', description: 'Damage +20%', rarity: 'Common' },
    { id: 'spd', title: 'Ion Thrusters', description: 'Move Speed +15%', rarity: 'Common' },
    { id: 'multi', title: 'Twin Barrel', description: 'Add +1 Projectile', rarity: 'Rare' },
    { id: 'fire', title: 'Rapid Cooler', description: 'Fire Rate +20%', rarity: 'Rare' },
    { id: 'hp', title: 'Nano Hull', description: 'Max HP +50', rarity: 'Common' },
    { id: 'homing', title: 'Smart Rounds', description: 'Projectiles home in on enemies', rarity: 'Legendary' }
];

const UpgradeMenu: React.FC<Props> = ({ onSelect, player }) => {
    const [options, setOptions] = useState<Upgrade[]>([]);

    useEffect(() => {
        // Generate 3 random options
        const generated = [];
        for(let i=0; i<3; i++) {
            const base = UPGRADES_LIST[Math.floor(Math.random() * UPGRADES_LIST.length)];
            // Re-attach logic
            const upgrade: Upgrade = {
                ...base,
                apply: (p) => {
                    if(base.id === 'dmg') p.damage *= 1.2;
                    if(base.id === 'spd') p.speed *= 1.15;
                    if(base.id === 'multi') p.multishot += 1;
                    if(base.id === 'fire') p.fireRate = Math.max(2, p.fireRate * 0.8);
                    if(base.id === 'hp') { p.maxHp += 50; p.hp += 50; }
                    if(base.id === 'homing') p.homing = true;
                }
            };
            generated.push(upgrade);
        }
        setOptions(generated);
    }, [player]);

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
            <h2 className="text-5xl font-black text-orange-400 mb-2 drop-shadow-[0_0_15px_rgba(255,165,0,0.5)]">LEVEL UP!</h2>
            <p className="text-gray-300 mb-8 text-xl">Select a system upgrade</p>
            
            <div className="flex gap-8 flex-wrap justify-center">
                {options.map((u, idx) => (
                    <div 
                        key={idx}
                        onClick={() => onSelect(u)}
                        className="w-60 h-80 bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-gray-600 rounded-xl p-6 flex flex-col items-center text-center cursor-pointer hover:-translate-y-2 hover:border-orange-400 hover:shadow-[0_0_30px_rgba(255,170,0,0.3)] transition-all duration-200 group"
                    >
                        <div className={`text-xs font-bold tracking-[0.2em] uppercase mb-4 ${
                            u.rarity === 'Legendary' ? 'text-purple-400' : u.rarity === 'Rare' ? 'text-cyan-400' : 'text-gray-400'
                        }`}>
                            {u.rarity}
                        </div>
                        <div className="text-2xl font-bold text-white mb-4 group-hover:text-orange-400 transition-colors">
                            {u.title}
                        </div>
                        <div className="text-gray-400 text-sm leading-relaxed">
                            {u.description}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default UpgradeMenu;