export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    this.load.image("bgMachine", "public/assets/images/backgrounds/Machine.jpg");
    this.load.image("bgHuman", "public/assets/images/backgrounds/Human.jpg");
    this.load.image("propWater", "public/assets/images/props/waterbottle.png");
    this.load.image("propCola", "public/assets/images/props/cola.png");
    this.load.image("propCoffee", "public/assets/images/props/coffee.png");
    this.load.image("propIce", "public/assets/images/props/icecube.png");
    this.load.image("propTea", "public/assets/images/props/tea.png");
    this.load.image("propJuice", "public/assets/images/props/juice.png");
    this.load.image("charStudent", "public/assets/images/props/student1.png");
    this.load.audio("menuBgm", "public/assets/audio/music/After_The_Last_Train.mp3");
    this.load.audio("rainLineSfx", "public/assets/audio/music/Rain_Against_the_Glass.mp3");
    this.load.audio("typingSfx", "public/assets/audio/sfx/typing.mp3");
    this.load.audio("freshenUpSfx", "public/assets/audio/sfx/FreshenUp.mp3");
    this.load.audio("uiHoverSfx", "public/assets/audio/sfx/Buttonsound.mp3");
    this.load.audio("cicadaSfx", "public/assets/audio/sfx/Cicada.mp3");
    this.load.audio("staticSfx", "public/assets/audio/sfx/Static.mp3");
    this.load.audio("flatlineSfx", "public/assets/audio/sfx/Flatline.mp3");
  }

  async create() {
    if (typeof document !== "undefined" && document.fonts && document.fonts.load) {
      try {
        await document.fonts.load('16px "Yoster"');
        await document.fonts.ready;
      } catch (error) {
        // Continue boot even if the Font Loading API fails.
      }
    }

    this.scene.start("OpeningScene");
  }
}
