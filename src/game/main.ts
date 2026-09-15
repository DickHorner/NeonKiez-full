import { Game as MainGame } from './scenes/Game';
import { AUTO, Game, Scale, Types } from 'phaser';
import { Asteroids } from './scenes/Asteroids';
import { SchoolPongCourt } from './scenes/SchoolPongCourt';
import { RooftopInvaders } from './scenes/RooftopInvaders';
import { createSession } from './session';

const config: Types.Core.GameConfig = {
    type: AUTO,

    width: 640,
    height: 360,

    parent: 'game-container',
    backgroundColor: '#202030',

    physics: {
        default: 'arcade',
        arcade: {
            gravity: {
                x: 0,
                y: 0
            },
            debug: true
        }
    },

    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    }
};

const StartGame = (parent: string) => {
    const session = createSession();
    const hub = new MainGame(session);
    const asteroids = new Asteroids(session);
    const court = new SchoolPongCourt(session);
    const rooftop = new RooftopInvaders(session);
    // Standalone entry while the LDtk hub artwork is being authored.
    const dungeon = new URLSearchParams(window.location.search).get('dungeon');
    return new Game({
        ...config,
        parent,
        scene: dungeon === 'RooftopInvaders' ? [rooftop, hub, asteroids, court]
            : dungeon === 'SchoolPongCourt' ? [court, hub, asteroids, rooftop]
            : [hub, asteroids, court, rooftop]
    });
};

export default StartGame;