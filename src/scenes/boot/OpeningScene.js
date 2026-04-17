export class OpeningScene extends Phaser.Scene {
  constructor() {
    super("OpeningScene");
    this.targetLines = [
      "Summer, 2026.",
      "The cicadas' sound only seems to make the summer heat feel heavier.",
    ];
    this.currentLineIndex = 0;
    this.currentIndex = 0;
    this.storyText = null;
    this.cursorText = null;
    this.cursorBlinkTween = null;
    this.glitchBars = null;
    this.glitchPulseCount = 0;
    this.typingLoop = null;
    this.cicadaLoop = null;
    this.openingStaticLoop = null;
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#000000");

    this.add.rectangle(width * 0.5, height * 0.5, width, height, 0x040404, 1);
    this.createVignetteOverlay(width, height);

    this.glitchBars = this.add.graphics();
    this.glitchBars.setDepth(10);

    this.storyText = this.add
      .text(width * 0.5, height * 0.5, "", {
        fontFamily: "Yoster",
        fontSize: "22px",
        color: "#f2f5f8",
        align: "center",
        wordWrap: { width: width * 0.8, useAdvancedWrap: true },
      })
      .setOrigin(0.5)
      .setAlpha(0.92)
      .setDepth(12);

    this.cursorText = this.add
      .text(width * 0.5, height * 0.5, "_", {
        fontFamily: "Yoster",
        fontSize: "26px",
        color: "#cfd6dd",
      })
      .setOrigin(0, 0.5)
      .setAlpha(0)
      .setDepth(12);

    this.runOpeningGlitch();
  }

  createVignetteOverlay(width, height) {
    this.add.rectangle(width * 0.5, 0, width, 92, 0x000000, 0.62).setOrigin(0.5, 0);
    this.add.rectangle(width * 0.5, height, width, 104, 0x000000, 0.68).setOrigin(0.5, 1);
    this.add.rectangle(0, height * 0.5, 96, height, 0x000000, 0.58).setOrigin(0, 0.5);
    this.add.rectangle(width, height * 0.5, 96, height, 0x000000, 0.58).setOrigin(1, 0.5);
  }

  runOpeningGlitch() {
    const glitchPulses = 16;
    this.glitchPulseCount = 0;

    if (!this.openingStaticLoop) {
      this.openingStaticLoop = this.sound.add("staticSfx", {
        loop: true,
        volume: 0.52,
      });
    }

    if (!this.openingStaticLoop.isPlaying) {
      this.openingStaticLoop.play();
    }

    this.time.addEvent({
      delay: 75,
      repeat: glitchPulses - 1,
      callback: () => {
        this.glitchPulseCount += 1;
        this.drawGlitchFrame();

        if (this.glitchPulseCount / glitchPulses > 0.6) {
          this.cameras.main.setScroll(Phaser.Math.Between(-1, 1), Phaser.Math.Between(-1, 1));
        }
      },
      callbackScope: this,
    });

    this.time.delayedCall(glitchPulses * 75 + 130, () => {
      if (this.openingStaticLoop && this.openingStaticLoop.isPlaying) {
        this.openingStaticLoop.stop();
      }

      this.cameras.main.setScroll(0, 0);
      this.glitchBars.clear();
      this.beginTyping();
    });
  }

  drawGlitchFrame() {
    if (!this.glitchBars) {
      return;
    }

    const { width, height } = this.scale;

    this.glitchBars.clear();

    const barCount = Phaser.Math.Between(4, 8);
    for (let i = 0; i < barCount; i += 1) {
      const y = Phaser.Math.Between(0, height);
      const h = Phaser.Math.Between(1, 4);
      const alpha = Phaser.Math.FloatBetween(0.08, 0.18);
      const xOffset = Phaser.Math.Between(-8, 8);
      this.glitchBars.fillStyle(0xffffff, alpha);
      this.glitchBars.fillRect(xOffset, y, width + 16, h);
    }

    this.glitchBars.fillStyle(0x000000, 0.35);
    this.glitchBars.fillRect(0, Phaser.Math.Between(0, height), width, Phaser.Math.Between(8, 22));
  }

  beginTyping() {
    this.currentIndex = 0;
    this.storyText.setText("");

    if (this.currentLineIndex === 1) {
      this.startCicadaUnderSecondLine();
    }

    this.startTypingSound();

    this.cursorText.setAlpha(0.9);
    this.ensureCursorBlink();

    this.typeNextCharacter();
  }

  typeNextCharacter() {
    const activeLine = this.targetLines[this.currentLineIndex] || "";

    if (this.currentIndex >= activeLine.length) {
      this.handleLineComplete();
      return;
    }

    const char = activeLine[this.currentIndex];
    const nextString = activeLine.slice(0, this.currentIndex + 1);
    this.storyText.setText(nextString);

    const delay = this.getTypingDelay(char);
    this.applyTypingCadence(char, delay);

    this.currentIndex += 1;

    this.time.delayedCall(delay, () => this.typeNextCharacter());
  }

  handleLineComplete() {
    this.stopTypingSound();

    if (this.currentLineIndex === 0) {
      this.time.delayedCall(700, () => {
        this.currentLineIndex = 1;
        this.beginTyping();
      });
      return;
    }

    this.finishOpening();
  }

  startCicadaUnderSecondLine() {
    if (!this.cicadaLoop) {
      this.cicadaLoop = this.sound.add("cicadaSfx", {
        loop: true,
        volume: 0.52,
      });
    }

    this.tweens.killTweensOf(this.cicadaLoop);
    this.cicadaLoop.setVolume(0.52);

    if (!this.cicadaLoop.isPlaying) {
      this.cicadaLoop.play();
    }

    this.tweens.add({
      targets: this.cicadaLoop,
      volume: 0,
      duration: 5000,
      ease: "Linear",
      onComplete: () => {
        if (this.cicadaLoop && this.cicadaLoop.isPlaying) {
          this.cicadaLoop.stop();
        }
      },
    });
  }

  getTypingDelay(char) {
    if (char === ",") {
      return 180;
    }

    if (char === ".") {
      return 300;
    }

    if (char === " ") {
      return 38;
    }

    if (/[0-9]/.test(char)) {
      return 58;
    }

    return Phaser.Math.Between(46, 62);
  }

  finishOpening() {
    this.stopTypingSound();

    if (this.cicadaLoop && this.cicadaLoop.isPlaying) {
      this.cicadaLoop.stop();
    }

    this.time.delayedCall(2200, () => {
      this.tweens.add({
        targets: [this.storyText, this.cursorText],
        alpha: 0,
        duration: 420,
        ease: "Sine.easeInOut",
      });

      this.cameras.main.fadeOut(520, 0, 0, 0);
      this.time.delayedCall(550, () => {
        this.scene.start("IntroScene");
      });
    });
  }

  ensureCursorBlink() {
    if (this.cursorBlinkTween) {
      return;
    }

    this.cursorBlinkTween = this.tweens.add({
      targets: this.cursorText,
      alpha: 0.2,
      duration: 300,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  applyTypingCadence(char, delay) {
    if (!this.typingLoop || !this.typingLoop.isPlaying) {
      return;
    }

    const normalVolume = 0.14;
    this.tweens.killTweensOf(this.typingLoop);

    if (char === " ") {
      this.typingLoop.setRate(0.98);
      this.typingLoop.setVolume(0.05);
      this.tweens.add({
        targets: this.typingLoop,
        volume: normalVolume,
        duration: 100,
        delay: Math.max(0, delay - 100),
        ease: "Linear",
      });
      return;
    }

    if (char === "," || char === ".") {
      this.typingLoop.setRate(0.95);
      this.typingLoop.setVolume(0.0);
      this.tweens.add({
        targets: this.typingLoop,
        volume: normalVolume,
        duration: 120,
        delay: Math.max(0, delay - 120),
        ease: "Linear",
      });
      return;
    }

    if (/[0-9]/.test(char)) {
      this.typingLoop.setRate(1.03);
      this.typingLoop.setVolume(normalVolume);
      return;
    }

    this.typingLoop.setRate(1.0);
    this.typingLoop.setVolume(normalVolume);
  }

  startTypingSound() {
    if (!this.typingLoop) {
      this.typingLoop = this.sound.add("typingSfx", {
        loop: true,
        volume: 0.14,
        rate: 1,
      });
    }

    if (!this.typingLoop.isPlaying) {
      this.typingLoop.play();
    }
  }

  stopTypingSound() {
    if (!this.typingLoop) {
      return;
    }

    this.tweens.killTweensOf(this.typingLoop);
    this.typingLoop.setRate(1);
    this.typingLoop.setVolume(0.14);

    if (this.typingLoop.isPlaying) {
      this.typingLoop.stop();
    }
  }
}
