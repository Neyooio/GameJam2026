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
    this.staticLines = null;
    this.subtleFlickerLoop = null;
    this.nextSwitchEvent = null;
    this.preSwitchActive = false;
    this.crtScanlines = null;
    this.vignetteImage = null;
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
    this.addCrtOverlay();

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

    // Colors matching the gritty environment
    const panelFillColor = 0x2a211c;
    const panelStrokeColor = 0x1f1612;
    const buttonFillColor = 0x3d3029;
    const accentColor = 0xf5b942;
    const textColor = "#f5e6d3";
    const textHoverColor = "#2a211c";

    const centerX = width * 0.82;
    const groupCenterY = height * 0.50; // Dead center vertically
    const centerY = groupCenterY - 27; // Shift up to center the group
    const tutorialCenterY = groupCenterY + 27; // Shift down

    // Button now acts as its own embedded element directly on the wall
    this.playButtonShadow = this.add.rectangle(centerX - 2, centerY - 2, 140, 34, 0x000000, 0.6).setDepth(10);
    this.playButton = this.add.rectangle(centerX, centerY, 140, 34, buttonFillColor, 0.9).setDepth(10);
    this.playButton.setStrokeStyle(2, accentColor, 1);

    this.playText = this.add
      .text(centerX, centerY, "PLAY", {
        fontFamily: "Yoster",
        fontSize: "16px",
        color: textColor,
        shadow: { fill: true, offsetX: 1, offsetY: 1, color: "#000000", blur: 0 },
      })
      .setOrigin(0.5)
      .setDepth(10);

    // Invisible, stationary hit box to prevent hover-jitter loops
    // using a rectangle instead of a zone ensures stable hit-area configuration on all Phaser versions
    this.playZone = this.add.rectangle(centerX, centerY, 140, 34, 0x000000, 0)
      .setDepth(20)
      .setInteractive({ useHandCursor: true });

    this.playZone.on("pointerover", () => {
      // Check cache first to avoid crashes if audio file is missing
      if (this.cache.audio.exists("uiHoverSfx")) {
        this.sound.play("uiHoverSfx", { volume: 0.5 });
      }
      this.playButton.setFillStyle(accentColor, 1);
      this.playText.setColor(textHoverColor);
      this.playText.setShadowOffset(0, 0); // Remove shadow when hovering for flat inset look
      // Press slightly IN when hovering
      this.playButton.setPosition(centerX - 1, centerY - 1);
      this.playText.setPosition(centerX - 1, centerY - 1);
    });

    this.playZone.on("pointerout", () => {
      this.playButton.setFillStyle(buttonFillColor, 0.9);
      this.playText.setColor(textColor);
      this.playText.setShadowOffset(1, 1);
      this.playButton.setPosition(centerX, centerY);
      this.playText.setPosition(centerX, centerY);
    });

    this.playZone.on("pointerdown", (pointer) => {
      if (!pointer.leftButtonDown()) {
        return;
      }
      if (this.cache.audio.exists("uiClickSfx")) {
        this.sound.play("uiClickSfx", { volume: 0.6 });
      }
      this.cameras.main.flash(160, 178, 246, 255, true);
    });

    // Tutorial Button
    this.tutorialButtonShadow = this.add.rectangle(centerX - 2, tutorialCenterY - 2, 140, 34, 0x000000, 0.6).setDepth(10);
    this.tutorialButton = this.add.rectangle(centerX, tutorialCenterY, 140, 34, buttonFillColor, 0.9).setDepth(10);
    this.tutorialButton.setStrokeStyle(2, accentColor, 1);

    this.tutorialText = this.add
      .text(centerX, tutorialCenterY, "TUTORIAL", {
        fontFamily: "Yoster",
        fontSize: "16px",
        color: textColor,
        shadow: { fill: true, offsetX: 1, offsetY: 1, color: "#000000", blur: 0 },
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.tutorialZone = this.add.rectangle(centerX, tutorialCenterY, 140, 34, 0x000000, 0)
      .setDepth(20)
      .setInteractive({ useHandCursor: true });

    this.tutorialZone.on("pointerover", () => {
      if (this.cache.audio.exists("uiHoverSfx")) {
        this.sound.play("uiHoverSfx", { volume: 0.5 });
      }
      this.tutorialButton.setFillStyle(accentColor, 1);
      this.tutorialText.setColor(textHoverColor);
      this.tutorialText.setShadowOffset(0, 0);
      this.tutorialButton.setPosition(centerX - 1, tutorialCenterY - 1);
      this.tutorialText.setPosition(centerX - 1, tutorialCenterY - 1);
    });

    this.tutorialZone.on("pointerout", () => {
      this.tutorialButton.setFillStyle(buttonFillColor, 0.9);
      this.tutorialText.setColor(textColor);
      this.tutorialText.setShadowOffset(1, 1);
      this.tutorialButton.setPosition(centerX, tutorialCenterY);
      this.tutorialText.setPosition(centerX, tutorialCenterY);
    });

    this.tutorialZone.on("pointerdown", (pointer) => {
      if (!pointer.leftButtonDown()) {
        return;
      }
      if (this.cache.audio.exists("uiClickSfx")) {
        this.sound.play("uiClickSfx", { volume: 0.6 });
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
      image.setPosition(width * 0.5, height * 0.5);
    });

    const centerX = width * 0.82;
    const groupCenterY = height * 0.50;
    const centerY = groupCenterY - 27;
    const tutorialCenterY = groupCenterY + 27;

    if (this.playButtonShadow) {
      this.playButtonShadow.setPosition(centerX - 2, centerY - 2);
    }

    if (this.playButton) {
      this.playButton.setPosition(centerX, centerY);
    }

    if (this.playText) {
      this.playText.setPosition(centerX, centerY);
    }

    if (this.playZone) {
      this.playZone.setPosition(centerX, centerY);
    }

    if (this.tutorialButtonShadow) {
      this.tutorialButtonShadow.setPosition(centerX - 2, tutorialCenterY - 2);
    }

    if (this.tutorialButton) {
      this.tutorialButton.setPosition(centerX, tutorialCenterY);
    }

    if (this.tutorialText) {
      this.tutorialText.setPosition(centerX, tutorialCenterY);
    }

    if (this.tutorialZone) {
      this.tutorialZone.setPosition(centerX, tutorialCenterY);
    }

    if (this.staticLines && this.backgroundKeys[this.activeIndex] === "bgHuman" && this.preSwitchActive) {
      this.renderStaticLines(0.1);
    }

    // Re-draw CRT overlays to match new dimensions
    this.drawScanlines();
    this.createVignette();
  }
}
