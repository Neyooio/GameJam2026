import { BootScene } from "./scenes/boot/BootScene.js";
import { IntroScene } from "./scenes/boot/IntroScene.js";
import { MainMenuScene } from "./scenes/ui/MainMenuScene.js";

const config = {
  type: Phaser.AUTO,
  parent: "game-root",
  width: 640,
  height: 360,
  backgroundColor: "#0f151a",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, IntroScene, MainMenuScene],
};

new Phaser.Game(config);
