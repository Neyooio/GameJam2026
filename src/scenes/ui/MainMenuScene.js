export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
    this.backgroundKeys = ["bgHuman", "bgMachine"];
    this.backgroundImages = [];
    this.activeIndex = 0;
    this.isTransitioning = false;
    this.panel = null;
    this.titleText = null;
    this.playButton = null;
    this.playText = null;
    this.staticLines = null;
    this.subtleFlickerLoop = null;
    this.nextSwitchEvent = null;
    this.preSwitchActive = false;
  }

  create() {
    const { width, height } = this.scale;

    const menuBgm = this.sound.get("menuBgm");
    if (menuBgm) {
      if (!menuBgm.isPlaying) {
        menuBgm.play({ loop: true, volume: 0.32 });
      }
    } else {
      this.sound.play("menuBgm", { loop: true, volume: 0.32 });
    }

    this.backgroundImages = this.backgroundKeys.map((key, index) => {
      const image = this.add.image(width * 0.5, height * 0.5, key).setAlpha(index === 0 ? 1 : 0);
      this.fitImageToCamera(image);
      return image;
    });

    this.addOverlayUI();

    this.updateHumanVisualState();
    this.scheduleNextSwitch();

    this.scale.on("resize", this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.nextSwitchEvent) {
        this.nextSwitchEvent.remove(false);
        this.nextSwitchEvent = null;
      }
      this.stopSubtleFlickerLoop();
      this.scale.off("resize", this.handleResize, this);
    });
  }

  addOverlayUI() {
    const { width, height } = this.scale;

    this.panel = this.add.rectangle(width * 0.5, height * 0.76, width * 0.48, 92, 0x041116, 0.63);
    this.panel.setStrokeStyle(2, 0x76d9ff, 0.7);

    this.titleText = this.add
      .text(width * 0.5, height * 0.72, "MAIN MENU", {
        fontFamily: "Yoster",
        fontSize: "16px",
        color: "#c8f4ff",
      })
      .setOrigin(0.5);

    this.playButton = this.add.rectangle(width * 0.5, height * 0.79, 140, 34, 0x0d2e3c, 0.85);
    this.playButton.setStrokeStyle(2, 0xa5ecff, 0.95);
    this.playButton.setInteractive({ useHandCursor: true });

    this.playText = this.add
      .text(width * 0.5, height * 0.79, "PLAY", {
        fontFamily: "Yoster",
        fontSize: "16px",
        color: "#ebfbff",
      })
      .setOrigin(0.5);

    this.playButton.on("pointerover", () => {
      this.playButton.setFillStyle(0x134458, 0.92);
      this.playText.setColor("#ffffff");
    });

    this.playButton.on("pointerout", () => {
      this.playButton.setFillStyle(0x0d2e3c, 0.85);
      this.playText.setColor("#ebfbff");
    });

    this.playButton.on("pointerdown", (pointer) => {
      if (!pointer.leftButtonDown()) {
        return;
      }

      this.cameras.main.flash(160, 178, 246, 255, true);
    });
  }

  transitionBackground() {
    if (this.isTransitioning || this.backgroundImages.length < 2) {
      return;
    }

    this.isTransitioning = true;

    const current = this.backgroundImages[this.activeIndex];
    const nextIndex = (this.activeIndex + 1) % this.backgroundImages.length;
    const next = this.backgroundImages[nextIndex];
    next.setAlpha(0);
    next.setVisible(true);

    this.tweens.add({
      targets: next,
      alpha: 1,
      duration: 700,
      ease: "Sine.easeOut",
      onComplete: () => {
        current.setVisible(false);
        current.setAlpha(0);

        this.activeIndex = nextIndex;
        this.preSwitchActive = false;
        this.updateHumanVisualState();
        this.isTransitioning = false;
      },
    });

    this.tweens.add({
      targets: current,
      alpha: 0,
      duration: 700,
      ease: "Sine.easeOut",
    });
  }

  scheduleNextSwitch() {
    if (this.nextSwitchEvent) {
      this.nextSwitchEvent.remove(false);
    }

    this.nextSwitchEvent = this.time.delayedCall(20000, () => {
      this.beginSwitchSequence();
    });
  }

  beginSwitchSequence() {
    const activeKey = this.backgroundKeys[this.activeIndex];
    if (activeKey === "bgHuman") {
      this.runPreSwitchStatic(() => {
        this.transitionBackground();
        this.scheduleNextSwitch();
      });
      return;
    }

    this.transitionBackground();
    this.scheduleNextSwitch();
  }

  updateHumanVisualState() {
    const activeKey = this.backgroundKeys[this.activeIndex];

    if (activeKey === "bgHuman") {
      this.startSubtleFlickerLoop();
      if (this.preSwitchActive) {
        this.renderStaticLines(0.12);
      } else if (this.staticLines) {
        this.staticLines.setVisible(false);
      }
      return;
    }

    this.stopSubtleFlickerLoop();

    if (this.staticLines) {
      this.staticLines.setVisible(false);
    }

    const humanIndex = this.backgroundKeys.indexOf("bgHuman");
    if (humanIndex >= 0 && this.backgroundImages[humanIndex]) {
      this.backgroundImages[humanIndex].setAlpha(this.activeIndex === humanIndex ? 1 : 0);
    }
  }

  startSubtleFlickerLoop() {
    if (this.subtleFlickerLoop) {
      return;
    }

    this.subtleFlickerLoop = this.time.addEvent({
      delay: 1650,
      loop: true,
      callback: () => {
        const humanIndex = this.backgroundKeys.indexOf("bgHuman");
        const humanImage = this.backgroundImages[humanIndex];
        if (!humanImage || this.activeIndex !== humanIndex) {
          return;
        }

        humanImage.setAlpha(0.965);

        this.tweens.add({
          targets: humanImage,
          alpha: 1,
          duration: 220,
          ease: "Linear",
        });
      },
    });
  }

  stopSubtleFlickerLoop() {
    if (!this.subtleFlickerLoop) {
      return;
    }

    this.subtleFlickerLoop.remove(false);
    this.subtleFlickerLoop = null;
  }

  runPreSwitchStatic(onComplete) {
    if (this.preSwitchActive) {
      return;
    }

    this.preSwitchActive = true;
    const humanIndex = this.backgroundKeys.indexOf("bgHuman");
    const humanImage = this.backgroundImages[humanIndex];
    if (!humanImage || this.activeIndex !== humanIndex) {
      this.preSwitchActive = false;
      onComplete();
      return;
    }

    this.renderStaticLines(0.08);
    if (this.staticLines) {
      this.staticLines.setVisible(true);
    }

    this.tweens.add({
      targets: humanImage,
      alpha: 0.94,
      duration: 240,
      yoyo: true,
      repeat: 8,
      ease: "Sine.easeInOut",
    });

    this.time.addEvent({
      delay: 180,
      repeat: 10,
      callback: () => {
        if (this.activeIndex !== humanIndex) {
          return;
        }

        this.renderStaticLines(0.1);
        if (this.staticLines) {
          this.staticLines.setVisible(true);
          this.staticLines.setAlpha(Phaser.Math.FloatBetween(0.08, 0.16));
        }
      },
    });

    this.time.delayedCall(2200, () => {
      onComplete();
    });
  }

  renderStaticLines(alpha = 0.12) {
    if (!this.staticLines) {
      this.staticLines = this.add.graphics();
      this.staticLines.setDepth(20);
    }

    this.staticLines.clear();
    this.staticLines.fillStyle(0xffffff, alpha);

    const lineCount = 16;
    const lineHeight = 1;
    const spacing = this.scale.height / lineCount;

    for (let i = 0; i < lineCount; i += 1) {
      const y = Math.floor(i * spacing + Phaser.Math.Between(-1, 1));
      const lineWidth = Phaser.Math.Between(Math.floor(this.scale.width * 0.7), this.scale.width);
      this.staticLines.fillRect(0, y, lineWidth, lineHeight);
    }

    this.staticLines.setVisible(true);
  }

  fitImageToCamera(image) {
    const source = image.texture.getSourceImage();
    const scaleX = this.scale.width / source.width;
    const scaleY = this.scale.height / source.height;
    const scale = Math.max(scaleX, scaleY);

    image.setPosition(this.scale.width * 0.5, this.scale.height * 0.5);
    image.setScale(scale);
    image.setData("baseScale", scale);
  }

  handleResize(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;

    this.backgroundImages.forEach((image) => {
      this.fitImageToCamera(image);
      image.setPosition(width * 0.5, height * 0.5);
    });

    if (this.panel) {
      this.panel.setPosition(width * 0.5, height * 0.76);
      this.panel.setSize(width * 0.48, 92);
    }

    if (this.titleText) {
      this.titleText.setPosition(width * 0.5, height * 0.72);
    }

    if (this.playButton) {
      this.playButton.setPosition(width * 0.5, height * 0.79);
    }

    if (this.playText) {
      this.playText.setPosition(width * 0.5, height * 0.79);
    }

    if (this.staticLines && this.backgroundKeys[this.activeIndex] === "bgHuman" && this.preSwitchActive) {
      this.renderStaticLines(0.1);
    }
  }
}
