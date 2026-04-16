export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    this.load.image("bgMachine", "public/assets/images/backgrounds/Machine.jpg");
    this.load.image("bgHuman", "public/assets/images/backgrounds/Human.jpg");
    this.load.audio("menuBgm", "public/assets/audio/music/After_The_Last_Train.mp3");
  }

  create() {
    const music = this.sound.get("menuBgm");
    if (music) {
      if (!music.isPlaying) {
        music.play({ loop: true, volume: 0.32 });
      }
    } else {
      this.sound.play("menuBgm", { loop: true, volume: 0.32 });
    }

    this.scene.start("IntroScene");
  }
}
