export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    this.load.image("bgMachine", "public/assets/images/backgrounds/Machine.jpg");
    this.load.image("bgHuman", "public/assets/images/backgrounds/Human.jpg");
    this.load.audio("menuBgm", "public/assets/audio/music/After_The_Last_Train.mp3");
    this.load.audio("typingSfx", "public/assets/audio/sfx/typing.mp3");
    this.load.audio("cicadaSfx", "public/assets/audio/sfx/Cicada.mp3");
  }

  create() {
    this.scene.start("OpeningScene");
  }
}
