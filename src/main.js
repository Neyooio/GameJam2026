import { BootScene } from "./scenes/boot/BootScene.js";
import { OpeningScene } from "./scenes/boot/OpeningScene.js";
import { IntroScene } from "./scenes/boot/IntroScene.js";
import { MainMenuScene } from "./scenes/ui/MainMenuScene.js";

const config = {
  type: Phaser.AUTO,
  parent: "game-root",
  width: 960,
  height: 540,
  backgroundColor: "#0f151a",
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, OpeningScene, IntroScene, MainMenuScene],
};

new Phaser.Game(config);
