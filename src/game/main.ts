import { Game as MainGame } from './scenes/Game';
import { AUTO, Game, Scale, Types } from 'phaser';
import { Asteroids } from './scenes/Asteroids';

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
    },

    scene: [
        MainGame,
        Asteroids
    ]
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;