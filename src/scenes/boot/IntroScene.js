export class IntroScene extends Phaser.Scene {
  constructor() {
    super("IntroScene");
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#0b1014");

    const titleBgm = this.sound.get("menuBgm") || this.sound.add("menuBgm", { loop: true, volume: 0 });
    if (!titleBgm.isPlaying) {
      titleBgm.play({ loop: true, volume: 0 });
    }

    this.tweens.killTweensOf(titleBgm);
    this.tweens.add({
      targets: titleBgm,
      volume: 0.24,
      duration: 1200,
      ease: "Sine.easeInOut",
    });

    const flatline = this.sound.get("flatlineSfx");
    const flatlineEndAt = this.registry.get("flatlineEndAt");
    if (flatline && flatline.isPlaying && flatlineEndAt) {
      const remaining = Math.max(0, flatlineEndAt - Date.now());

      if (remaining > 0) {
        const fadeDuration = Math.min(1000, remaining);
        const fadeDelay = Math.max(0, remaining - fadeDuration);

        this.time.delayedCall(fadeDelay, () => {
          this.tweens.add({
            targets: flatline,
            volume: 0,
            duration: fadeDuration,
            ease: "Sine.easeOut",
            onComplete: () => {
              if (flatline.isPlaying) {
                flatline.stop();
              }
              this.registry.remove("flatlineEndAt");
            },
          });
        });
      }
    }

    const title = this.add
      .text(width * 0.5, height * 0.5, "I REINCARNATED AS A VENDING MACHINE", {
        fontFamily: "Yoster",
        fontSize: "44px",
        color: "#e7f2ff",
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setScale(1);

    this.cameras.main.fadeIn(700, 0, 0, 0);
    this.time.delayedCall(720, () => {
      this.startTitleSequence(title);
    });
  }

  startTitleSequence(title) {
    this.tweens.add({
      targets: [title],
      alpha: 1,
      duration: 1250,
      ease: "Cubic.easeOut",
      onComplete: () => {
        this.time.delayedCall(4000, () => {
          this.playDustFadeOut(title, () => {
            this.playSceneTransition();
          });
        });
      },
    });
  }

  playDustFadeOut(title, onComplete) {
    const dustPieces = [];
    const pieceCount = 72;
    const spreadX = 280;
    const spreadY = 44;

    for (let i = 0; i < pieceCount; i += 1) {
      const radius = Phaser.Math.FloatBetween(1.2, 3.4);
      const dust = this.add
        .circle(
          title.x + Phaser.Math.Between(-spreadX, spreadX),
          title.y + Phaser.Math.Between(-spreadY, spreadY),
          radius,
          0xf4f8ff,
          Phaser.Math.FloatBetween(0.3, 0.68),
        )
        .setScale(Phaser.Math.FloatBetween(0.8, 1.15))
        .setDepth(title.depth + 1);

      dustPieces.push(dust);

      this.tweens.add({
        targets: dust,
        x: dust.x + Phaser.Math.Between(-30, 30),
        y: dust.y - Phaser.Math.Between(32, 72),
        scale: Phaser.Math.FloatBetween(0.35, 0.65),
        alpha: 0,
        duration: Phaser.Math.Between(900, 1450),
        delay: Phaser.Math.Between(0, 260),
        ease: "Cubic.easeOut",
        onComplete: () => {
          dust.destroy();
        },
      });
    }

    this.tweens.add({
      targets: title,
      alpha: 0,
      scale: 1.05,
      y: title.y - 8,
      duration: 1100,
      ease: "Sine.easeInOut",
      onComplete: () => {
        dustPieces.forEach((piece) => {
          if (piece && piece.active) {
            piece.destroy();
          }
        });
        onComplete();
      },
    });
  }

  playSceneTransition() {
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("MainMenuScene");
    });

    this.cameras.main.fadeOut(520, 0, 0, 0);
  }
}
