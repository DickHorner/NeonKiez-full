import { Game as MainGame } from './scenes/Game';
import { AUTO, Game, Scale, Types } from 'phaser';
import { Asteroids } from './scenes/Asteroids';
import { SchoolPongCourt } from './scenes/SchoolPongCourt';
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
    // Standalone entry while the LDtk hub artwork is being authored.
    const startCourt = new URLSearchParams(window.location.search).get('dungeon') === 'SchoolPongCourt';
    return new Game({
        ...config,
        parent,
        scene: startCourt ? [court, hub, asteroids] : [hub, asteroids, court]
    });
};

export default StartGame;