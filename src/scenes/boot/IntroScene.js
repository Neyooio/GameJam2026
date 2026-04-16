export class IntroScene extends Phaser.Scene {
  constructor() {
    super("IntroScene");
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#0b1014");

    const title = this.add
      .text(width * 0.5, height * 0.5, "I REINCARNATED AS A VENDING MACHINE", {
        fontFamily: "Yoster",
        fontSize: "18px",
        color: "#e7f2ff",
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({
      targets: title,
      alpha: 1,
      duration: 500,
      yoyo: true,
      hold: 1200,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.scene.start("MainMenuScene");
      },
    });
  }
}
