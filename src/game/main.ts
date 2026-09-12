import { Game as MainGame } from './scenes/Game';
import { AUTO, Game, Scale, Types } from 'phaser';
import { Asteroids } from './scenes/Asteroids';
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
    return new Game({
        ...config,
        parent,
        scene: [new MainGame(session), new Asteroids(session)]
    });
};

export default StartGame;