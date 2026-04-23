export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
    this.backgroundKeys = ["bgHuman", "bgMachine"];
    this.backgroundImages = [];
    this.activeIndex = 0;
    this.isTransitioning = false;
    this.playButton = null;
    this.playButtonShadow = null;
    this.playText = null;
    this.playZone = null;
    this.tutorialButton = null;
    this.tutorialButtonShadow = null;
    this.tutorialText = null;
    this.tutorialZone = null;
    this.exitButton = null;
    this.exitButtonShadow = null;
    this.exitText = null;
    this.exitZone = null;
    this.titleLines = [];
    this.staticLines = null;
    this.subtleFlickerLoop = null;
    this.nextSwitchEvent = null;
    this.preSwitchActive = false;
    this.backgroundDriftStates = [];
    this.sharedShakeTime = 0;
    this.sharedShakeSeed = Math.random() * 1000;
    this.crtScanlines = null;
    this.vignetteImage = null;
    this.isStartingGame = false;
  }

  create() {
    const { width, height } = this.scale;
    this.isStartingGame = false;
    this.isTransitioning = false;
    this.preSwitchActive = false;
    this.activeIndex = Phaser.Math.Clamp(this.activeIndex, 0, this.backgroundKeys.length - 1);

    // Ensure camera fade/flash state from previous scene transitions never carries over.
    this.cameras.main.resetFX();
    this.cameras.main.setAlpha(1);

    const menuBgm = this.sound.get("menuBgm");
    if (menuBgm) {
      if (!menuBgm.isPlaying) {
        menuBgm.play({ loop: true, volume: 0.32 });
      }
    } else {
      this.sound.play("menuBgm", { loop: true, volume: 0.32 });
    }

    this.backgroundImages = this.backgroundKeys.map((key, index) => {
      const image = this.add.image(width * 0.5, height * 0.5, key).setAlpha(index === this.activeIndex ? 1 : 0);
      this.fitImageToCamera(image);
      return image;
    });

    this.startBackgroundMotion();
    this.createAnimatedTitle();

    this.addOverlayUI();
    this.addCrtOverlay();

    this.updateHumanVisualState();
    this.scheduleNextSwitch();

    this.scale.on("resize", this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.nextSwitchEvent) {
        this.nextSwitchEvent.remove(false);
        this.nextSwitchEvent = null;
      }
      this.tweens.killTweensOf(this.backgroundDriftStates);
      this.backgroundDriftStates = [];
      this.stopSubtleFlickerLoop();
      this.scale.off("resize", this.handleResize, this);
    });
  }

  update(_, delta) {
    if (!this.backgroundImages.length) {
      return;
    }

    this.sharedShakeTime += delta / 1000;

    const primaryWave = Math.sin(this.sharedShakeTime * 2.4 + this.sharedShakeSeed);
    const secondaryWave = Math.sin(this.sharedShakeTime * 5.1 + this.sharedShakeSeed * 0.63);
    const sharedShakeX = primaryWave * 0.9 + secondaryWave * 0.35;
    const sharedShakeY = Math.cos(this.sharedShakeTime * 2.2 + this.sharedShakeSeed * 0.47) * 0.7;

    this.backgroundImages.forEach((image, index) => {
      const drift = this.backgroundDriftStates[index];
      const driftX = drift ? drift.x : 0;
      const driftY = drift ? drift.y : 0;

      image.setPosition(
        this.scale.width * 0.5 + sharedShakeX + driftX,
        this.scale.height * 0.5 + sharedShakeY + driftY,
      );
    });
  }

  startBackgroundMotion() {
    this.backgroundDriftStates = this.backgroundImages.map(() => ({ x: 0, y: 0 }));

    this.backgroundDriftStates.forEach((state, index) => {
      this.createBackgroundDriftTween(state, index);
    });
  }

  createBackgroundDriftTween(state, index) {
    const maxDriftX = 7;
    const maxDriftY = 5;
    const targetX = Phaser.Math.FloatBetween(-maxDriftX, maxDriftX) + (index === 0 ? -1.5 : 1.5);
    const targetY = Phaser.Math.FloatBetween(-maxDriftY, maxDriftY);

    this.tweens.add({
      targets: state,
      x: targetX,
      y: targetY,
      duration: Phaser.Math.Between(2600, 3800),
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.createBackgroundDriftTween(state, index);
      },
    });
  }

  createAnimatedTitle() {
    const { width, height } = this.scale;
    const leftX = width * 0.19;
    const centerY = height * 0.5;

    const specs = [
      { text: "I", xOffset: -24, yOffset: -100, size: "50px" },
      { text: "REINCARNATED", xOffset: 30, yOffset: -24, size: "44px" },
      { text: "AS A", xOffset: -12, yOffset: 40, size: "36px" },
      { text: "VENDING MACHINE", xOffset: 38, yOffset: 106, size: "46px" },
    ];

    this.titleLines = specs.map((spec) => {
      const targetX = leftX + spec.xOffset;
      const targetY = centerY + spec.yOffset;

      const line = this.add
        .text(-460, targetY, spec.text, {
          fontFamily: "Yoster",
          fontSize: spec.size,
          color: "#f7fbff",
          stroke: "#141c24",
          strokeThickness: 3,
          shadow: { fill: true, offsetX: 4, offsetY: 4, color: "#000000", blur: 0 },
        })
        .setOrigin(0.5)
        .setAlpha(0.98)
        .setDepth(14);

      line.setData("targetX", targetX);
      line.setData("targetY", targetY);

      return line;
    });

    this.titleLines.forEach((line, index) => {
      this.tweens.add({
        targets: line,
        x: line.getData("targetX"),
        duration: 760,
        delay: 120 + index * 110,
        ease: "Cubic.easeOut",
      });
    });
  }

  addOverlayUI() {
    const { width, height } = this.scale;

    // Colors matching the gritty environment
    const buttonFillColor = 0x3d3029;
    const accentColor = 0xf5b942;
    const textColor = "#f5e6d3";
    const textHoverColor = "#2a211c";

    const centerX = width * 0.82;
    const groupCenterY = height * 0.50; // Dead center vertically
    const centerY = groupCenterY - 54;
    const tutorialCenterY = groupCenterY;
    const exitCenterY = groupCenterY + 54;

    const buttonStyles = {
      buttonFillColor,
      accentColor,
      textColor,
      textHoverColor,
    };

    const playEntry = this.createMenuButton(centerX, centerY, "PLAY", buttonStyles, () => this.startGameplay(false));
    this.playButtonShadow = playEntry.shadow;
    this.playButton = playEntry.button;
    this.playText = playEntry.text;
    this.playZone = playEntry.zone;

    const tutorialEntry = this.createMenuButton(centerX, tutorialCenterY, "TUTORIAL", buttonStyles, () => this.startGameplay(true));
    this.tutorialButtonShadow = tutorialEntry.shadow;
    this.tutorialButton = tutorialEntry.button;
    this.tutorialText = tutorialEntry.text;
    this.tutorialZone = tutorialEntry.zone;

    const exitEntry = this.createMenuButton(centerX, exitCenterY, "EXIT", buttonStyles, () => {
      if (this.cache.audio.exists("uiClickSfx")) {
        this.sound.play("uiClickSfx", { volume: 0.6 });
      }

      this.cameras.main.flash(180, 255, 255, 255, true);
      this.time.delayedCall(190, () => {
        this.game.destroy(true);
      });
    });
    this.exitButtonShadow = exitEntry.shadow;
    this.exitButton = exitEntry.button;
    this.exitText = exitEntry.text;
    this.exitZone = exitEntry.zone;
  }

  createMenuButton(centerX, centerY, label, styles, onClick) {
    const { buttonFillColor, accentColor, textColor, textHoverColor } = styles;

    const shadow = this.add.rectangle(centerX - 2, centerY - 2, 140, 34, 0x000000, 0.6).setDepth(10);
    const button = this.add.rectangle(centerX, centerY, 140, 34, buttonFillColor, 0.9).setDepth(10);
    button.setStrokeStyle(2, accentColor, 1);

    const text = this.add
      .text(centerX, centerY, label, {
        fontFamily: "Yoster",
        fontSize: "16px",
        color: textColor,
        shadow: { fill: true, offsetX: 1, offsetY: 1, color: "#000000", blur: 0 },
      })
      .setOrigin(0.5)
      .setDepth(10);

    const zone = this.add.rectangle(centerX, centerY, 140, 34, 0x000000, 0)
      .setDepth(20)
      .setInteractive({ useHandCursor: true });

    zone.on("pointerover", () => {
      this.playHoverSfx();
      button.setFillStyle(accentColor, 1);
      text.setColor(textHoverColor);
      text.setShadowOffset(0, 0);
      button.setPosition(centerX - 1, centerY - 1);
      text.setPosition(centerX - 1, centerY - 1);
    });

    zone.on("pointerout", () => {
      button.setFillStyle(buttonFillColor, 0.9);
      text.setColor(textColor);
      text.setShadowOffset(1, 1);
      button.setPosition(centerX, centerY);
      text.setPosition(centerX, centerY);
    });

    zone.on("pointerdown", (pointer) => {
      if (!pointer.leftButtonDown()) {
        return;
      }
      onClick();
    });

    return { shadow, button, text, zone };
  }

  setMenuButtonPosition(shadow, button, text, zone, centerX, centerY) {
    if (shadow) {
      shadow.setPosition(centerX - 2, centerY - 2);
    }

    if (button) {
      button.setPosition(centerX, centerY);
    }

    if (text) {
      text.setPosition(centerX, centerY);
    }

    if (zone) {
      zone.setPosition(centerX, centerY);
    }
  }

  startGameplay(tutorialMode) {
    if (this.isStartingGame) {
      return;
    }

    this.isStartingGame = true;

    if (this.cache.audio.exists("uiClickSfx")) {
      this.sound.play("uiClickSfx", { volume: 0.6 });
    }

    this.cameras.main.flash(160, 178, 246, 255, true);
    this.time.delayedCall(120, () => {
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start("OverheatPuzzleScene", { tutorial: tutorialMode });
      });
      this.cameras.main.fadeOut(260, 10, 16, 24);
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
    const overscanPx = 24;
    const scaleX = (this.scale.width + overscanPx * 2) / source.width;
    const scaleY = (this.scale.height + overscanPx * 2) / source.height;
    const scale = Math.max(scaleX, scaleY);

    image.setPosition(this.scale.width * 0.5, this.scale.height * 0.5);
    image.setScale(scale);
    image.setData("baseScale", scale);
  }

  addCrtOverlay() {
    this.drawScanlines();
    this.createVignette();
  }

  drawScanlines() {
    const { width, height } = this.scale;

    if (!this.crtScanlines) {
      this.crtScanlines = this.add.graphics();
      this.crtScanlines.setDepth(50);
    }

    this.crtScanlines.clear();

    // Thin dark lines every 3px to simulate CRT scanlines
    const lineSpacing = 3;
    this.crtScanlines.fillStyle(0x000000, 0.12);
    for (let y = 0; y < height; y += lineSpacing) {
      this.crtScanlines.fillRect(0, y, width, 1);
    }

    // Faint bright highlight lines every 6px for phosphor glow illusion
    this.crtScanlines.fillStyle(0xffffff, 0.015);
    for (let y = 1; y < height; y += lineSpacing * 2) {
      this.crtScanlines.fillRect(0, y, width, 1);
    }
  }

  createVignette() {
    const { width, height } = this.scale;
    const key = "__crt_vignette";

    // Remove previous vignette image if it exists
    if (this.vignetteImage) {
      this.vignetteImage.destroy();
      this.vignetteImage = null;
    }

    // Remove old texture to avoid key-clash on resize
    if (this.textures.exists(key)) {
      this.textures.remove(key);
    }

    // Create a CanvasTexture and draw a radial gradient vignette
    const canvasTex = this.textures.createCanvas(key, width, height);
    const ctx = canvasTex.getContext();

    // Radial gradient: transparent center → dark edges
    const cx = width * 0.5;
    const cy = height * 0.5;
    const innerRadius = Math.min(width, height) * 0.25;
    const outerRadius = Math.max(width, height) * 0.85;

    const gradient = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(0.5, "rgba(0, 0, 0, 0.15)");
    gradient.addColorStop(0.8, "rgba(0, 0, 0, 0.45)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.75)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    canvasTex.refresh();

    this.vignetteImage = this.add.image(cx, cy, key)
      .setDepth(49)
      .setAlpha(1);
  }

  handleResize(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;

    this.backgroundImages.forEach((image) => {
      this.fitImageToCamera(image);
    });

    const centerX = width * 0.82;
    const groupCenterY = height * 0.50;
    const centerY = groupCenterY - 54;
    const tutorialCenterY = groupCenterY;
    const exitCenterY = groupCenterY + 54;

    this.setMenuButtonPosition(this.playButtonShadow, this.playButton, this.playText, this.playZone, centerX, centerY);
    this.setMenuButtonPosition(
      this.tutorialButtonShadow,
      this.tutorialButton,
      this.tutorialText,
      this.tutorialZone,
      centerX,
      tutorialCenterY,
    );
    this.setMenuButtonPosition(this.exitButtonShadow, this.exitButton, this.exitText, this.exitZone, centerX, exitCenterY);

    if (this.titleLines.length) {
      const leftX = width * 0.19;
      const centerY = height * 0.5;
      const offsets = [
        { x: -24, y: -100 },
        { x: 30, y: -24 },
        { x: -12, y: 40 },
        { x: 38, y: 106 },
      ];

      this.titleLines.forEach((line, index) => {
        const offset = offsets[index] || { x: 0, y: 0 };
        const targetX = leftX + offset.x;
        const targetY = centerY + offset.y;
        line.setData("targetX", targetX);
        line.setData("targetY", targetY);
        line.setPosition(targetX, targetY);
      });
    }

    if (this.staticLines && this.backgroundKeys[this.activeIndex] === "bgHuman" && this.preSwitchActive) {
      this.renderStaticLines(0.1);
    }

    // Re-draw CRT overlays to match new dimensions
    this.drawScanlines();
    this.createVignette();
  }

  playHoverSfx() {
    if (!this.cache.audio.exists("uiHoverSfx")) {
      return;
    }

    const hoverSfx = this.sound.add("uiHoverSfx", {
      volume: 0.45,
      rate: Phaser.Math.FloatBetween(0.98, 1.04),
    });

    hoverSfx.once("complete", () => {
      hoverSfx.destroy();
    });

    hoverSfx.play();
  }
}
