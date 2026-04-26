import { BootScene } from "./scenes/boot/BootScene.js";
import { OpeningScene } from "./scenes/boot/OpeningScene.js";
import { IntroScene } from "./scenes/boot/IntroScene.js";
import { MainMenuScene } from "./scenes/ui/MainMenuScene.js";
import { OverheatPuzzleScene } from "./scenes/gameplay/OverheatPuzzleScene.js";
import { TutorialScene } from "./scenes/gameplay/TutorialScene.js";

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
  dom: {
    createContainer: true,
  },
  scene: [BootScene, OpeningScene, IntroScene, MainMenuScene, OverheatPuzzleScene, TutorialScene],
};

new Phaser.Game(config);
