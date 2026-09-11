import { Scene } from 'phaser';

export class Asteroids extends Scene
{
    constructor ()
    {
        super('Asteroids');
    }

    create ()
    {
        this.cameras.main.setBackgroundColor('#000000');

        this.add.text(
            320,
            180,
            'ASTEROIDS',
            {
                fontFamily: 'monospace',
                fontSize: 48,
                color: '#ffffff'
            }
        ).setOrigin(0.5);
    }
}