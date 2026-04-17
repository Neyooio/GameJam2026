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
    const pieceCount = 42;
    const spreadX = 250;
    const spreadY = 36;

    for (let i = 0; i < pieceCount; i += 1) {
      const dust = this.add
        .rectangle(
          title.x + Phaser.Math.Between(-spreadX, spreadX),
          title.y + Phaser.Math.Between(-spreadY, spreadY),
          Phaser.Math.Between(1, 3),
          Phaser.Math.Between(1, 3),
          0xe8eef7,
          Phaser.Math.FloatBetween(0.15, 0.42),
        )
        .setDepth(title.depth + 1);

      dustPieces.push(dust);

      this.tweens.add({
        targets: dust,
        x: dust.x + Phaser.Math.Between(-24, 24),
        y: dust.y - Phaser.Math.Between(20, 54),
        alpha: 0,
        duration: Phaser.Math.Between(540, 980),
        delay: Phaser.Math.Between(0, 180),
        ease: "Sine.easeOut",
        onComplete: () => {
          dust.destroy();
        },
      });
    }

    this.tweens.add({
      targets: title,
      alpha: 0,
      scale: 1.04,
      y: title.y - 6,
      duration: 920,
      ease: "Cubic.easeOut",
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
