import { Game as MainGame } from './scenes/Game';
import { AUTO, Game, Scale, Types } from 'phaser';
import { Asteroids } from './scenes/Asteroids';
import { SchoolPongCourt } from './scenes/SchoolPongCourt';
import { RooftopInvaders } from './scenes/RooftopInvaders';
import { VideoStorePlatform } from './scenes/VideoStorePlatform';
import { SubwayTiming } from './scenes/SubwayTiming';
import { LaundromatLabyrinth } from './scenes/LaundromatLabyrinth';
import { WarehouseBlockworks } from './scenes/WarehouseBlockworks';
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
    const videoStore = new VideoStorePlatform(session);
    const subway = new SubwayTiming(session);
    const laundromat = new LaundromatLabyrinth(session);
    const warehouse = new WarehouseBlockworks(session);
    // Standalone entry while the LDtk hub artwork is being authored.
    const dungeon = new URLSearchParams(window.location.search).get('dungeon');
    return new Game({
        ...config,
        parent,
        scene: dungeon === 'WarehouseBlockworks' ? [warehouse, hub, asteroids, court, rooftop, videoStore, subway, laundromat]
            : dungeon === 'LaundromatLabyrinth' ? [laundromat, hub, asteroids, court, rooftop, videoStore, subway, warehouse]
            : dungeon === 'SubwayTiming' ? [subway, hub, asteroids, court, rooftop, videoStore, laundromat, warehouse]
            : dungeon === 'VideoStorePlatform' ? [videoStore, hub, asteroids, court, rooftop, subway, laundromat, warehouse]
            : dungeon === 'RooftopInvaders' ? [rooftop, hub, asteroids, court, videoStore, subway, laundromat, warehouse]
            : dungeon === 'SchoolPongCourt' ? [court, hub, asteroids, rooftop, videoStore, subway, laundromat, warehouse]
            : dungeon === 'Asteroids' ? [asteroids, hub, court, rooftop, videoStore, subway, laundromat, warehouse]
            : [hub, asteroids, court, rooftop, videoStore, subway, laundromat, warehouse]
    });
};

export default StartGame;