export class OverheatPuzzleScene extends Phaser.Scene {
  constructor() {
    super("OverheatPuzzleScene");

    this.gridSize = 5;
    this.cellSize = 86;
    this.boardX = 34;
    this.boardY = 92;

    this.board = [];
    this.freezeTurns = [];

    this.turnCount = 0;
    this.score = 0;
    this.gameOver = false;
    this.isResolving = false;
    this.tutorialMode = false;
    this.heatPhaseMoveThreshold = 50;
    this.heatPhaseDurationMoves = 7;
    this.heatPhaseActive = false;
    this.heatPhaseTriggered = false;
    this.heatPhaseMovesRemaining = 0;

    this.coldSnapPhaseMoveThreshold = 50;
    this.coldSnapPhaseDurationMoves = 7;
    this.coldSnapPhaseActive = false;
    this.coldSnapPhaseTriggered = false;
    this.coldSnapPhaseMovesRemaining = 0;

    this.iceCoreMax = 20;
    this.iceCore = 16;

    this.coffeePassiveInterval = 3;

    this.burstThresholds = {
      water: 3,
      juice: 4,
      tea: 6,
      cola: 5,
      coffee: 2,
      ice: 999,
    };

    this.iceChargeMax = 6;

    this.productColors = {
      water: 0x66b8ff,
      juice: 0xff8f5a,
      tea: 0x78c764,
      cola: 0xf04949,
      coffee: 0x9b6a4c,
      ice: 0x79ddff,
    };

    this.itemSpriteKeys = {
      water: "propWater",
      juice: "propJuice",
      tea: "propTea",
      cola: "propCola",
      coffee: "propCoffee",
      ice: "propIce",
    };

    this.spawnBag = [];
    this.spawnBagTemplate = [
      "water",
      "water",
      "water",
      "juice",
      "juice",
      "tea",
      "tea",
      "cola",
      "coffee",
    ];

    this.cellRects = [];
    this.tileSprites = [];
    this.freezeTexts = [];

    this.iceCoreText = null;
    this.scoreText = null;
    this.turnText = null;
    this.messageText = null;
    this.iceCoreBar = null;

    this.cutIn = {
      overlay: null,
      stripe: null,
      stripeAccent: null,
      stripeAccentTop: null,
      title: null,
      subtitle: null,
      sprite: null,
      particles: [],
    };

    this.heatBoardOutline = null;
    this.heatBoardGlow = null;

    this.gameplayBgm = null;
    this.freshenUpSfx = null;
    this.heatIntensifiesSfx = null;
    this.coldSnapSfx = null;
    this.activeHeatCutInState = null;
    this.comboSfxByKey = {};
    this.activeComboSfx = null;
    this.activeColaBurstSound = null;
    this.turnFreshenCount = 0;
    this.turnFreshenTypes = new Set();
    this.turnComboTier = 0;
    this.turnComboSoundPlayed = false;
    this.isSlideAnimating = false;
    this.activeMoveSprites = [];

    this.customerSprite = null;
    this.customerBubble = null;
    this.customerText = null;

    this.iceMeltCause = null;
    this.coffeeBurstsThisInstance = 0;
    this.coffeeCoreGainsThisInstance = 0;
    this.coffeeInstanceStartIceCore = 0;
    this.lowCoreFx = {
      active: false,
      shakeIdx: -1,
      lastMeltParticleAt: 0,
      lastRightParticleAt: 0,
    };
  }

  init(data) {
    this.tutorialMode = Boolean(data && data.tutorial);
  }

  create() {
    this.setupModeValues();
    this.initializeState();
    this.createLayout();
    this.bindInput();
    this.initializeGameplayAudio();

    this.ensureStartupIceTileVisible();

    // Safety pass on the next tick in case another startup flow touched board visuals.
    this.time.delayedCall(0, () => {
      if (this.sys && this.sys.isActive()) {
        this.ensureStartupIceTileVisible();
      }
    });
  }

  ensureStartupIceTileVisible() {
    this.ensureInitialIceTile();
    this.normalizeIceState();

    let icePos = null;
    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const tile = this.board[y][x];
        if (tile && tile.type === "ice") {
          icePos = { x, y };
          break;
        }
      }
      if (icePos) {
        break;
      }
    }

    if (!icePos) {
      this.board[0][0] = { type: "ice", tier: 1, charge: 0 };
      this.freezeTurns[0][0] = 0;
      icePos = { x: 0, y: 0 };
    }

    if (this.iceCore <= 0) {
      this.iceCore = this.iceCoreMax;
    }

    this.refreshAll();

    // Explicitly force the startup ice tile sprite visible after refresh.
    const idx = icePos.y * this.gridSize + icePos.x;
    const spriteBase = this.tileSpritesBase[idx];
    const sprite = this.tileSprites[idx];
    if (!spriteBase || !sprite) {
      return;
    }

    this.placeTileSprite(spriteBase, "ice");
    this.placeTileSprite(sprite, "ice");
    spriteBase.setAlpha(0.6).setVisible(true).setAngle(0).setScale(sprite.scaleX, sprite.scaleY);
    sprite.setAlpha(1).setVisible(true).setAngle(0);
    sprite.setCrop();
  }

  update() {
    if (this.cutIn && this.cutIn.sprite && this.cutIn.sprite.visible && this.cutIn.spriteShadow) {
      this.cutIn.spriteShadow.setVisible(true);
      this.cutIn.spriteShadow.x = this.cutIn.sprite.x + 12;
      this.cutIn.spriteShadow.y = this.cutIn.sprite.y + 16;
      this.cutIn.spriteShadow.scaleX = this.cutIn.sprite.scaleX * 0.92;
      this.cutIn.spriteShadow.scaleY = this.cutIn.sprite.scaleY * 0.92;
      this.cutIn.spriteShadow.angle = this.cutIn.sprite.angle;
      this.cutIn.spriteShadow.alpha = this.cutIn.sprite.alpha * 0.34;
    } else if (this.cutIn && this.cutIn.spriteShadow) {
      this.cutIn.spriteShadow.setVisible(false);
    }

    this.updateLowIceCoreEffects();
  }

  setupModeValues() {
    if (this.tutorialMode) {
      this.iceCoreMax = 22;
      this.iceCore = 22;
    } else {
      this.iceCoreMax = 20;
      this.iceCore = 20;
    }
  }

  initializeState() {
    this.board = Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(null));
    this.freezeTurns = Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(0));

    this.turnCount = 0;
    this.score = 0;
    this.gameOver = false;
    this.isResolving = false;
    this.heatPhaseActive = false;
    this.heatPhaseTriggered = false;
    this.heatPhaseMovesRemaining = 0;
    this.heatPhaseEndedTriggered = false;

    this.coldSnapPhaseActive = false;
    this.coldSnapPhaseTriggered = false;
    this.coldSnapPhaseMovesRemaining = 0;
    this.coldSnapPhaseEndedTriggered = false;

    this.coffeePassiveInterval = 3;
    this.resetTurnComboState();
    this.isSlideAnimating = false;
    this.activeMoveSprites = [];

    this.customerActive = false;
    this.customerWantedType = null;
    this.customerCooldown = 5;

    this.iceMeltCause = null;
    this.coffeeBurstsThisInstance = 0;
    this.coffeeCoreGainsThisInstance = 0;
    this.coffeeInstanceStartIceCore = this.iceCore;
    this.lowCoreFx.active = false;
    this.lowCoreFx.shakeIdx = -1;
    this.lowCoreFx.lastMeltParticleAt = 0;
    this.lowCoreFx.lastRightParticleAt = 0;

    this.spawnBag = [];
    this.refillSpawnBag();
  }

  initializeGameplayAudio() {
    const menuBgm = this.sound.get("menuBgm");
    if (menuBgm && menuBgm.isPlaying) {
      menuBgm.stop();
    }

    this.gameplayBgm = this.sound.get("gameplayBgm");
    if (!this.gameplayBgm && this.cache.audio.exists("gameplayBgm")) {
      this.gameplayBgm = this.sound.add("gameplayBgm", { loop: true, volume: 0.42 });
    }

    if (this.gameplayBgm) {
      this.gameplayBgm.setLoop(true);
      this.gameplayBgm.setVolume(0.42);
      this.gameplayBgm.setMute(this.registry.get("muteBgm") || false);
      if (!this.gameplayBgm.isPlaying) {
        this.gameplayBgm.play();
      }
    }
  }

  stopGameplayAudio() {
    if (this.gameplayBgm && this.gameplayBgm.isPlaying) {
      this.gameplayBgm.stop();
    }
  }

  playSfx(key, config = {}) {
    if (this.registry.get("muteSfx") || !this.sys || !this.sys.isActive() || !this.sound || !this.cache.audio.exists(key)) {
      return;
    }

    this.sound.play(key, config);
  }

  playColaExplosionSfx() {
    if (this.registry.get("muteSfx") || !this.sys || !this.sys.isActive() || !this.sound || !this.cache.audio.exists("colaBurstSfx")) {
      return;
    }

    if (this.activeColaBurstSound) {
      if (this.activeColaBurstSound.isPlaying) {
        this.activeColaBurstSound.stop();
      }
      this.activeColaBurstSound.destroy();
      this.activeColaBurstSound = null;
    }

    const boom = this.sound.add("colaBurstSfx", { volume: 1.35, rate: 1.04 });
    this.activeColaBurstSound = boom;
    boom.play({ volume: 1.35, rate: 1.04, seek: 0.02 });

    this.time.delayedCall(720, () => {
      if (this.activeColaBurstSound !== boom) {
        return;
      }

      if (boom.isPlaying) {
        boom.stop();
      }
      boom.destroy();
      this.activeColaBurstSound = null;
    });
  }

  stopComboTierSounds() {
    if (this.activeComboSfx && this.activeComboSfx.isPlaying) {
      this.activeComboSfx.stop();
    }
    this.activeComboSfx = null;
  }

  playExclusiveComboSfx(key, volume) {
    if (this.registry.get("muteSfx") || !this.sys || !this.sys.isActive() || !this.sound || !this.cache.audio.exists(key)) {
      return;
    }

    this.stopComboTierSounds();

    if (!this.comboSfxByKey[key]) {
      this.comboSfxByKey[key] = this.sound.add(key, { volume });
    }

    const sfx = this.comboSfxByKey[key];
    if (!sfx) {
      return;
    }

    sfx.setVolume(volume);
    sfx.play({ volume });
    this.activeComboSfx = sfx;
    return sfx;
  }

  resetTurnComboState() {
    this.turnFreshenCount = 0;
    this.turnFreshenTypes = new Set();
    this.turnComboTier = 0;
    this.turnComboSoundPlayed = false;
  }

  playFinalComboTierSfx(onDone = null) {
    if (this.turnComboSoundPlayed) {
      if (onDone) {
        onDone();
      }
      return;
    }

    this.turnComboSoundPlayed = true;

    let sfx = null;

    if (this.turnComboTier === 1) {
      sfx = this.playExclusiveComboSfx("comboRefreshingSfx", 0.45);
    } else if (this.turnComboTier === 2) {
      sfx = this.playExclusiveComboSfx("comboSweetDrinkSfx", 0.5);
    } else if (this.turnComboTier >= 3) {
      sfx = this.playExclusiveComboSfx("comboColdBreezeSfx", 0.55);
    }

    if (!onDone) {
      return;
    }

    if (!sfx || !sfx.isPlaying) {
      onDone();
      return;
    }

    sfx.once("complete", onDone);
  }

  getFreshenComboBonus(type) {
    this.turnFreshenCount += 1;
    this.turnFreshenTypes.add(type);

    let detectedTier = 0;
    if (this.turnFreshenCount >= 3 && this.turnFreshenTypes.size >= 3) {
      detectedTier = 3;
    } else if (this.turnFreshenCount >= 3) {
      detectedTier = 2;
    } else if (this.turnFreshenCount >= 2) {
      detectedTier = 1;
    }

    this.turnComboTier = Math.max(this.turnComboTier, detectedTier);

    if (this.turnComboTier === 3) {
      return 4;
    }

    if (this.turnComboTier === 2) {
      return 2.5;
    }

    if (this.turnComboTier === 1) {
      return 2;
    }

    return 1;
  }

  killTweensForObjects(targets) {
    targets.forEach((target) => {
      if (target) {
        this.tweens.killTweensOf(target);
      }
    });
  }

  cleanupTransientAnimationState(skipRefresh = false) {
    this.isSlideAnimating = false;

    this.killTweensForObjects(this.activeMoveSprites);
    this.activeMoveSprites.forEach((temp) => {
      if (temp && temp.active) {
        temp.destroy();
      }
    });
    this.activeMoveSprites = [];

    this.tileSpritesBase.forEach((sprite) => {
      if (sprite) {
        this.tweens.killTweensOf(sprite);
      }
    });

    this.tileSprites.forEach((sprite) => {
      if (sprite) {
        this.tweens.killTweensOf(sprite);
      }
    });

    this.cellRects.forEach((rect) => {
      if (rect) {
        this.tweens.killTweensOf(rect);
      }
    });

    if (!skipRefresh && this.sys && this.sys.isActive()) {
      this.refreshBoardView();
    }
  }

  isTileSpriteUsable(sprite) {
    return Boolean(sprite && sprite.scene && sprite.scene.sys);
  }

  getTileFillRatio(tile) {
    if (!tile) {
      return 0;
    }

    if (tile.type === "ice") {
      return Phaser.Math.Clamp(this.iceCore / this.iceCoreMax, 0, 1);
    }

    const charge = tile.charge || 0;
    const cap = this.getChargeCapForType(tile.type);
    return Phaser.Math.Clamp(charge / cap, 0, 1);
  }

  resetTileVisualTransform(idx) {
    const x = idx % this.gridSize;
    const y = Math.floor(idx / this.gridSize);
    const center = this.getCellCenter(x, y);
    const rect = this.cellRects[idx];
    const spriteBase = this.tileSpritesBase[idx];
    const sprite = this.tileSprites[idx];

    if (rect) {
      rect.setScale(1);
    }

    if (spriteBase) {
      spriteBase.setPosition(center.x, center.y);
      spriteBase.setAngle(0);
      spriteBase.setAlpha(0.6);
    }

    if (sprite) {
      sprite.setPosition(center.x, center.y);
      sprite.setAngle(0);
      sprite.setAlpha(1);
    }
  }

  createLayout() {
    const { width, height } = this.scale;
    this.add.image(width / 2, height / 2, "bgVendingMachine").setDisplaySize(width, height).setDepth(-100);

    const title = this.tutorialMode ? "FREEZE MERGE - TUTORIAL" : "FREEZE MERGE";

    this.add
      .text(249, 26, title, {
        fontFamily: "Yoster",
        fontSize: "30px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setStroke("#000000", 6)
      .setShadow(2, 2, "#000000", 0, true, false);

    this.add
      .text(249, 65, "Slide with Arrow keys or on-screen controls.\nSame drinks merge and charge slots.", {
        fontFamily: "Yoster",
        fontSize: "13px",
        color: "#ffffff",
        align: "center",
      })
      .setOrigin(0.5)
      .setStroke("#000000", 4)
      .setShadow(1, 1, "#000000", 0, true, false);

    this.createBoardViews();
    this.createRightPanel();
    this.createControls();
    this.createCutInOverlay();

    this.addWireSparks();
    this.addRedLightGlow();

    this.setMessage("Merge same drinks to fill slot colors. Full slot triggers Freshen Up and bursts.");
  }

  addWireSparks() {
    // The wires are located on the edges of the vending machine.
    const wireAreas = [
      { minX: 890, maxX: 930, minY: 100, maxY: 160 }, // Top right
      { minX: 890, maxX: 930, minY: 280, maxY: 330 }, // Mid right
      { minX: 890, maxX: 930, minY: 440, maxY: 490 }, // Bottom right
      { minX: 30, maxX: 70, minY: 120, maxY: 400 }    // Left side (occasional)
    ];

    const spawnSparkBurst = () => {
      // Safety check in case scene was destroyed
      if (!this.sys || !this.sys.game || !this.add || !this.time) return;

      const isOverheated = this.heatPhaseActive;
      const area = Phaser.Utils.Array.GetRandom(wireAreas);
      const x = Phaser.Math.Between(area.minX, area.maxX);
      const y = Phaser.Math.Between(area.minY, area.maxY);

      const sparkCount = isOverheated ? Phaser.Math.Between(20, 35) : Phaser.Math.Between(8, 15);
      for (let i = 0; i < sparkCount; i++) {
        const sparkSize = isOverheated ? Phaser.Math.Between(2, 4) : Phaser.Math.Between(1, 3);
        const color = Math.random() > 0.4 ? (isOverheated ? 0xffaa00 : 0xffffff) : 0x79ddff;
        const spark = this.add.rectangle(x, y, sparkSize, sparkSize, color).setDepth(-10);

        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const baseSpeed = isOverheated ? Phaser.Math.FloatBetween(40, 120) : Phaser.Math.FloatBetween(20, 60);
        const targetX = x + Math.cos(angle) * baseSpeed;
        const targetY = y + Math.sin(angle) * baseSpeed + (isOverheated ? 60 : 40); // gravity effect

        this.tweens.add({
          targets: spark,
          x: targetX,
          y: targetY,
          alpha: 0,
          rotation: Phaser.Math.FloatBetween(-Math.PI * 2, Math.PI * 2),
          duration: isOverheated ? Phaser.Math.Between(200, 500) : Phaser.Math.Between(300, 700),
          ease: "Power1",
          onComplete: () => {
            if (spark) spark.destroy();
          }
        });
      }

      // If overheated, trigger bursts rapidly. Otherwise, standard interval.
      const nextDelay = isOverheated
        ? Phaser.Math.Between(300, 800)
        : Phaser.Math.Between(3000, 5000);

      this.time.delayedCall(nextDelay, spawnSparkBurst);
    };

    // Schedule the first burst
    this.time.delayedCall(Phaser.Math.Between(1000, 4000), spawnSparkBurst);
  }

  addRedLightGlow() {
    const { width } = this.scale;
    // Moved slightly down and slightly to the right side
    const lightX = width * 0.5 + 30; // Moving right (+15 pixels)
    const lightY = 70; // Moving down (+17 pixels)

    // A soft red outer glow
    const outerGlow = this.add.circle(lightX, lightY, 24, 0xff0000, 0.25).setDepth(-99);
    // A slightly brighter, smaller inner core
    const innerGlow = this.add.circle(lightX, lightY, 8, 0xff4444, 0.4).setDepth(-99);

    // Smoothly pulse the alpha and scale of both circles
    this.tweens.add({
      targets: [outerGlow, innerGlow],
      alpha: { getStart: () => 0.1, getEnd: () => 0.5 },
      scale: { getStart: () => 0.85, getEnd: () => 1.15 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  getIceTilePosition() {
    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const tile = this.board[y][x];
        if (tile && tile.type === "ice") {
          return { x, y };
        }
      }
    }

    return null;
  }

  stopLowIceCoreEffects() {
    if (this.lowCoreFx.shakeIdx >= 0) {
      this.resetTileVisualTransform(this.lowCoreFx.shakeIdx);
    }

    this.lowCoreFx.active = false;
    this.lowCoreFx.shakeIdx = -1;
  }

  updateLowIceCoreEffects() {
    if (!this.sys || !this.sys.isActive() || this.gameOver || this.iceCore <= 0 || this.iceCore > 5) {
      this.stopLowIceCoreEffects();
      return;
    }

    const icePos = this.getIceTilePosition();
    if (!icePos) {
      this.stopLowIceCoreEffects();
      return;
    }

    const idx = icePos.y * this.gridSize + icePos.x;
    const intensity = Phaser.Math.Clamp((6 - this.iceCore) / 5, 0.2, 1);
    const now = this.time.now;

    if (!this.lowCoreFx.active || this.lowCoreFx.shakeIdx !== idx) {
      this.lowCoreFx.active = true;
      this.lowCoreFx.shakeIdx = idx;
      this.lowCoreFx.lastMeltParticleAt = now;
      this.lowCoreFx.lastRightParticleAt = now;
    }

    const spriteBase = this.tileSpritesBase[idx];
    const sprite = this.tileSprites[idx];
    const rect = this.cellRects[idx];

    if (spriteBase && sprite && rect && !this.tweens.isTweening([spriteBase, sprite])) {
      const center = this.getCellCenter(icePos.x, icePos.y);
      rect.setStrokeStyle(3, 0xff6666, 1);

      this.tweens.add({
        targets: [spriteBase, sprite],
        x: { from: center.x - (1.2 + intensity), to: center.x + (1.2 + intensity) },
        y: { from: center.y - 0.5, to: center.y + 0.5 },
        duration: 55,
        yoyo: true,
        repeat: 0,
        ease: "Sine.easeInOut",
        onComplete: () => {
          if (spriteBase && spriteBase.active) {
            spriteBase.x = center.x;
            spriteBase.y = center.y;
          }
          if (sprite && sprite.active) {
            sprite.x = center.x;
            sprite.y = center.y;
          }
        },
      });
    }

    const meltInterval = Phaser.Math.Linear(260, 85, intensity);
    if (now - this.lowCoreFx.lastMeltParticleAt >= meltInterval) {
      this.spawnLowCoreMeltParticles(icePos.x, icePos.y, intensity);
      this.lowCoreFx.lastMeltParticleAt = now;
    }

    const rightInterval = Phaser.Math.Linear(300, 70, intensity);
    if (now - this.lowCoreFx.lastRightParticleAt >= rightInterval) {
      this.spawnLowCoreRightSideParticles(intensity);
      this.lowCoreFx.lastRightParticleAt = now;
    }
  }

  spawnLowCoreMeltParticles(x, y, intensity) {
    const center = this.getCellCenter(x, y);
    const count = intensity > 0.7 ? 5 : 3;

    for (let i = 0; i < count; i += 1) {
      const isSteam = Math.random() > 0.45;
      const color = isSteam ? 0xbfd6e8 : 0x79ddff;
      const particle = this.add
        .circle(center.x + Phaser.Math.Between(-20, 20), center.y + Phaser.Math.Between(8, 20), isSteam ? 2 : 3, color, isSteam ? 0.55 : 0.8)
        .setDepth(-10);

      this.tweens.add({
        targets: particle,
        x: particle.x + Phaser.Math.Between(-18, 18),
        y: particle.y + Phaser.Math.Between(18, 40),
        alpha: 0,
        scaleX: isSteam ? 1.8 : 0.45,
        scaleY: isSteam ? 1.2 : 0.35,
        duration: Phaser.Math.Between(300, 560),
        ease: "Quad.easeOut",
        onComplete: () => {
          particle.destroy();
        },
      });
    }
  }

  spawnLowCoreRightSideParticles(intensity) {
    const rightAreas = [
      { minX: 890, maxX: 944, minY: 360, maxY: 430 },
      { minX: 890, maxX: 944, minY: 470, maxY: 545 },
    ];

    const area = Phaser.Utils.Array.GetRandom(rightAreas);
    const count = intensity > 0.7 ? 7 : 4;

    for (let i = 0; i < count; i += 1) {
      const px = Phaser.Math.Between(area.minX, area.maxX);
      const py = Phaser.Math.Between(area.minY, area.maxY);
      const warm = Math.random() > 0.5;
      const p = this.add
        .rectangle(px, py, Phaser.Math.Between(2, 4), Phaser.Math.Between(2, 5), warm ? 0xffa860 : 0x9be7ff, 0.85)
        .setDepth(-10);

      this.tweens.add({
        targets: p,
        x: px + Phaser.Math.Between(-34, 34),
        y: py + Phaser.Math.Between(-22, 26),
        alpha: 0,
        angle: Phaser.Math.Between(-70, 70),
        duration: Phaser.Math.Between(260, 520),
        ease: "Cubic.easeOut",
        onComplete: () => {
          p.destroy();
        },
      });
    }
  }

  createBoardViews() {
    this.cellRects = [];
    this.tileSpritesStrokes = [];
    this.tileSpritesBase = [];
    this.tileSprites = [];
    this.freezeOverlays = [];
    this.freezeTexts = [];

    const boardWidth = this.gridSize * this.cellSize - 8;
    const boardHeight = this.gridSize * this.cellSize - 8;

    const screenWidth = this.scale.width;
    const screenHeight = this.scale.height;
    const screenCenterX = screenWidth * 0.5;
    const screenCenterY = screenHeight * 0.5;

    this.heatBoardGlowOuter = this.add
      .rectangle(screenCenterX, screenCenterY, screenWidth, screenHeight, 0xff0000, 0)
      .setStrokeStyle(40, 0xff0000, 0)
      .setDepth(248)
      .setVisible(false);

    this.heatBoardGlow = this.add
      .rectangle(screenCenterX, screenCenterY, screenWidth, screenHeight, 0xff5500, 0)
      .setStrokeStyle(20, 0xff5500, 0)
      .setDepth(249)
      .setVisible(false);

    this.heatBoardOutline = this.add
      .rectangle(screenCenterX, screenCenterY, screenWidth, screenHeight, 0xffaa00, 0)
      .setStrokeStyle(8, 0xffaa00, 0)
      .setDepth(250)
      .setVisible(false);

    this.coldBoardGlowOuter = this.add
      .rectangle(screenCenterX, screenCenterY, screenWidth, screenHeight, 0x0066ff, 0)
      .setStrokeStyle(40, 0x0066ff, 0)
      .setDepth(248)
      .setVisible(false);

    this.coldBoardGlow = this.add
      .rectangle(screenCenterX, screenCenterY, screenWidth, screenHeight, 0x00aaff, 0)
      .setStrokeStyle(20, 0x00aaff, 0)
      .setDepth(249)
      .setVisible(false);

    this.coldBoardOutline = this.add
      .rectangle(screenCenterX, screenCenterY, screenWidth, screenHeight, 0x00ffff, 0)
      .setStrokeStyle(8, 0x00ffff, 0)
      .setDepth(250)
      .setVisible(false);

    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const px = this.boardX + x * this.cellSize;
        const py = this.boardY + y * this.cellSize;

        const rect = this.add
          .rectangle(px, py, this.cellSize - 8, this.cellSize - 8, 0x1c2a36, 1)
          .setOrigin(0)
          .setStrokeStyle(2, 0x395365, 1);

        const strokes = [];
        const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (let i = 0; i < offsets.length; i++) {
          const s = this.add
            .image(px + (this.cellSize - 8) * 0.5 + offsets[i][0], py + (this.cellSize - 8) * 0.5 + offsets[i][1], "propWater")
            .setTint(0x000000)
            .setAlpha(0.6)
            .setVisible(false);
          strokes.push(s);
        }

        // Base dimensioned sprite that appears uncharged (dim/desaturated)
        const spriteBase = this.add
          .image(px + (this.cellSize - 8) * 0.5, py + (this.cellSize - 8) * 0.5, "propWater")
          .setTint(0x999999)
          .setAlpha(1)
          .setVisible(false);

        // Sprite on top that gets cropped bottom-to-top as charge fills up
        const sprite = this.add
          .image(px + (this.cellSize - 8) * 0.5, py + (this.cellSize - 8) * 0.5, "propWater")
          .setVisible(false);

        const freezeOverlay = this.add
          .image(px + (this.cellSize - 8) * 0.5, py + (this.cellSize - 8) * 0.5, "propIceBlock")
          .setAlpha(0.8)
          .setVisible(false);

        const freezeText = this.add
          .text(px + 8, py + 10, "", {
            fontFamily: "Yoster",
            fontSize: "10px",
            color: "#95e9ff",
          })
          .setOrigin(0, 0.5);

        this.cellRects.push(rect);
        this.tileSpritesStrokes.push(strokes);
        this.tileSpritesBase.push(spriteBase);
        this.tileSprites.push(sprite);
        this.freezeOverlays.push(freezeOverlay);
        this.freezeTexts.push(freezeText);
      }
    }
  }

  createRightPanel() {
    const { width } = this.scale;
    const panelX = width * 0.73;

    this.add.rectangle(panelX, 245, 245, 375, 0x152532, 1).setStrokeStyle(2, 0x355064, 1);

    // Customer Window
    this.add.image(panelX, 110, "bgCustomer").setDisplaySize(220, 95);
    this.add.rectangle(panelX, 110, 220, 95, 0x000000, 0).setStrokeStyle(2, 0x395365, 1);

    this.customerSpriteBaseY = 66;
    this.customerSpriteBaseX = panelX - 55;
    this.customerSpriteStartX = panelX + 55;

    const maskShape = this.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(panelX - 110, 110 - 47.5, 220, 95);
    const customerMask = maskShape.createGeometryMask();

    this.customerSprite = this.add.image(this.customerSpriteBaseX, this.customerSpriteBaseY, "student2").setVisible(false).setDepth(8).setOrigin(0.5, 0);
    this.customerSprite.setMask(customerMask);

    if (this.customerSprite.height) {
      // Adjust the multiplier to fit the upper half of the body (~48%) into the window
      const halfBodyHeight = this.customerSprite.height * 0.48;
      this.customerSprite.setScale(95 / halfBodyHeight);
    } else {
      this.customerSprite.setScale(0.45);
    }

    this.customerBubble = this.add.rectangle(panelX + 35, 100, 120, 50, 0xffffff, 1).setStrokeStyle(2, 0x000000, 1).setVisible(false).setDepth(9);
    this.customerText = this.add.text(panelX + 35, 100, "", {
      fontFamily: "Yoster",
      fontSize: "11px",
      color: "#000000",
      align: "center",
      wordWrap: { width: 110 },
    }).setOrigin(0.5).setVisible(false).setDepth(10);

    this.iceCoreText = this.add
      .text(panelX, 175, "", {
        fontFamily: "Yoster",
        fontSize: "18px",
        color: "#d7f3ff",
      })
      .setOrigin(0.5);

    this.iceCoreBar = this.add.rectangle(panelX - 98, 195, 196, 14, 0x79ddff, 1).setOrigin(0, 0.5);
    this.add.rectangle(panelX, 195, 196, 14, 0x2a3b48, 1).setOrigin(0.5).setDepth(this.iceCoreBar.depth - 1);

    this.scoreText = this.add
      .text(panelX, 225, "", {
        fontFamily: "Yoster",
        fontSize: "15px",
        color: "#ffe59b",
      })
      .setOrigin(0.5);

    this.turnText = this.add
      .text(panelX, 245, "", {
        fontFamily: "Yoster",
        fontSize: "15px",
        color: "#dce9f5",
      })
      .setOrigin(0.5);

    this.messageText = this.add
      .text(panelX, 265, "", {
        fontFamily: "Yoster",
        fontSize: "11px",
        color: "#9fc2dd",
        align: "center",
        wordWrap: { width: 220 },
      })
      .setOrigin(0.5, 0);

    this.add
      .text(panelX, 315, "BURST THRESHOLDS", {
        fontFamily: "Yoster",
        fontSize: "12px",
        color: "#d4e6f4",
      })
      .setOrigin(0.5);

    this.add
      .text(panelX, 345, "Water 3   Juice 4   Tea 6\nCola 5   Coffee 2", {
        fontFamily: "Yoster",
        fontSize: "11px",
        color: "#bcd0e2",
        align: "center",
      })
      .setOrigin(0.5);

    this.add
      .text(panelX, 395, "Slot fills by color as same items merge.\nWhen full, tile bursts and triggers skill.", {
        fontFamily: "Yoster",
        fontSize: "10px",
        color: "#95afc3",
        align: "center",
        wordWrap: { width: 220 },
      })
      .setOrigin(0.5);
  }

  createControls() {
    const { width, height } = this.scale;

    const leftX = width * 0.63;
    const rightX = width * 0.73;
    const midX = width * 0.68;

    const topY = height * 0.80;
    const midY = height * 0.87;
    const botY = height * 0.94;

    this.createButton(midX, topY, "UP", () => this.handleMove("up"), 78, 30);
    this.createButton(leftX, midY, "LEFT", () => this.handleMove("left"), 78, 30);
    this.createButton(rightX, midY, "RIGHT", () => this.handleMove("right"), 78, 30);
    this.createButton(midX, botY, "DOWN", () => this.handleMove("down"), 78, 30);

    this.createButton(width * 0.86, midY, "RESTART", () => this.scene.restart(), 132, 30);
    this.createButton(width * 0.86, botY, "BACK", () => this.scene.start("MainMenuScene"), 132, 30);
  }

  createButton(x, y, label, onClick, width = 120, height = 34) {
    const button = this.add.rectangle(x, y, width, height, 0x2a4255, 1).setStrokeStyle(2, 0x7fabca, 1);
    const text = this.add
      .text(x, y, label, {
        fontFamily: "Yoster",
        fontSize: "12px",
        color: "#eaf4ff",
      })
      .setOrigin(0.5);

    button.setInteractive({ useHandCursor: true });
    button.on("pointerover", () => button.setFillStyle(0x3a5d76, 1));
    button.on("pointerout", () => button.setFillStyle(0x2a4255, 1));
    button.on("pointerdown", () => onClick());

    return { button, text };
  }

  createCutInOverlay() {
    const { width, height } = this.scale;

    this.cutIn.overlay = this.add
      .rectangle(width * 0.5, height * 0.5, width, height, 0x000000, 0)
      .setDepth(250)
      .setVisible(false);

    this.cutIn.stripe = this.add
      .rectangle(width * 0.5, height * 0.5, width + 40, 110, 0x1c2f3f, 0)
      .setDepth(251)
      .setAngle(-2)
      .setVisible(false);

    this.cutIn.stripeAccent = this.add
      .rectangle(width * 0.5, height * 0.5 + 48, width + 40, 4, 0xffffff, 0)
      .setDepth(251)
      .setAngle(-2)
      .setVisible(false);

    this.cutIn.stripeAccentTop = this.add
      .rectangle(width * 0.5, height * 0.5 - 48, width + 40, 4, 0xffffff, 0)
      .setDepth(251)
      .setAngle(-2)
      .setVisible(false);

    this.cutIn.title = this.add
      .text(width * 0.5, height * 0.5 - 18, "", {
        fontFamily: "Yoster",
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(253)
      .setVisible(false);

    this.cutIn.subtitle = this.add
      .text(width * 0.5, height * 0.5 + 22, "", {
        fontFamily: "Yoster",
        fontSize: "14px",
        color: "#d4e8f7",
      })
      .setOrigin(0.5)
      .setDepth(253)
      .setVisible(false);

    this.cutIn.spriteShadow = this.add
      .image(width * 0.18, height * 0.5, "propCola")
      .setDepth(253)
      .setTint(0x000000)
      .setAlpha(0)
      .setVisible(false);

    this.cutIn.sprite = this.add
      .image(width * 0.18, height * 0.5, "propCola")
      .setDepth(254)
      .setVisible(false);

    this.cutIn.particles = [];
  }

  bindInput() {
    this.input.keyboard.on("keydown-UP", () => this.handleMove("up"));
    this.input.keyboard.on("keydown-DOWN", () => this.handleMove("down"));
    this.input.keyboard.on("keydown-LEFT", () => this.handleMove("left"));
    this.input.keyboard.on("keydown-RIGHT", () => this.handleMove("right"));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off("keydown-UP");
      this.input.keyboard.off("keydown-DOWN");
      this.input.keyboard.off("keydown-LEFT");
      this.input.keyboard.off("keydown-RIGHT");

      if (this.activeHeatCutInState && this.activeHeatCutInState.cleanup) {
        this.activeHeatCutInState.cleanup();
        this.activeHeatCutInState = null;
      }

      this.cleanupTransientAnimationState(true);
      this.stopComboTierSounds();
      this.stopLowIceCoreEffects();

      if (this.activeColaBurstSound) {
        if (this.activeColaBurstSound.isPlaying) {
          this.activeColaBurstSound.stop();
        }
        this.activeColaBurstSound.destroy();
        this.activeColaBurstSound = null;
      }

      if (this.freshenUpSfx) {
        this.freshenUpSfx.destroy();
        this.freshenUpSfx = null;
      }

      if (this.heatIntensifiesSfx) {
        if (this.heatIntensifiesSfx.isPlaying) {
          this.heatIntensifiesSfx.stop();
        }
        this.heatIntensifiesSfx.destroy();
        this.heatIntensifiesSfx = null;
      }

      if (this.coldSnapSfx) {
        if (this.coldSnapSfx.isPlaying) {
          this.coldSnapSfx.stop();
        }
        this.coldSnapSfx.destroy();
        this.coldSnapSfx = null;
      }

      Object.values(this.comboSfxByKey).forEach((sfx) => {
        if (sfx) {
          sfx.destroy();
        }
      });
      this.comboSfxByKey = {};

      this.stopGameplayAudio();
    });
  }

  ensureInitialIceTile() {
    if (this.hasAnyIceTile()) {
      if (this.iceCore <= 0) {
        this.iceCore = this.iceCoreMax;
      }
      return;
    }

    if (this.spawnOneTile("ice")) {
      this.iceCore = this.iceCoreMax;
      return;
    }

    const empties = this.getEmptyCells();
    if (empties.length > 0) {
      const { x, y } = empties[0];
      this.board[y][x] = { type: "ice", tier: 1, charge: 0 };
      this.freezeTurns[y][x] = 0;
      this.iceCore = this.iceCoreMax;
      return;
    }

    this.board[0][0] = { type: "ice", tier: 1, charge: 0 };
    this.freezeTurns[0][0] = 0;
    this.iceCore = this.iceCoreMax;
  }

  refillSpawnBag() {
    this.spawnBag = Phaser.Utils.Array.Shuffle([...this.spawnBagTemplate]);
  }

  drawSpawnType() {
    if (!this.spawnBag.length) {
      this.refillSpawnBag();
    }

    if (this.hasTypeOnBoard("coffee")) {
      let index = this.spawnBag.findIndex((item) => item !== "coffee");
      if (index === -1) {
        this.refillSpawnBag();
        index = this.spawnBag.findIndex((item) => item !== "coffee");
      }

      if (index !== -1) {
        const [picked] = this.spawnBag.splice(index, 1);
        return picked;
      }
    }

    return this.spawnBag.pop();
  }

  spawnOneTile(forcedType = null) {
    const empties = this.getEmptyCells();
    if (!empties.length) {
      return false;
    }

    const cell = Phaser.Utils.Array.GetRandom(empties);
    const type = forcedType || this.drawSpawnType();

    if (type === "ice" && this.hasAnyIceTile()) {
      return false;
    }

    this.board[cell.y][cell.x] = {
      type,
      tier: 1,
      charge: 0,
      coffeeSpreadCounter: type === "coffee" ? 0 : undefined,
    };

    if (type === "water") {
      this.iceCore = Math.min(this.iceCoreMax, this.iceCore + 1);
    }

    return true;
  }

  getEmptyCells() {
    const empties = [];

    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        if (!this.board[y][x]) {
          empties.push({ x, y });
        }
      }
    }

    return empties;
  }

  handleMove(direction) {
    if (this.gameOver || this.isResolving || (this.activeComboSfx && this.activeComboSfx.isPlaying)) {
      return;
    }

    const result = this.slideAndMerge(direction);
    if (!result.moved) {
      if (this.getEmptyCells().length === 0 && !this.hasLegalMove()) {
        this.triggerDeadlockGameOver();
        this.refreshAll();
        return;
      }

      this.setMessage("No movement.", "#ffb8a5");
      return;
    }

    this.isResolving = true;
    this.turnCount += 1;
    this.resetTurnComboState();

    this.checkSpecialPhaseProgression();

    this.playSfx("slideSfx", { volume: 0.22 });
    if (result.merges.length > 0) {
      this.playSfx("mergeSfx", { volume: 0.34 });
    }

    this.animateActions(result.actions, result.merges, () => {
      const waterMergeCount = result.merges.filter((merge) => merge.type === "water").length;
      if (waterMergeCount > 0) {
        this.chargeAllCoffeeBy(waterMergeCount);
      }

      this.applyMoveDecay(result.merges.length > 0);
      this.resolveIceMerges(result.merges);
      this.updateIceFillFromMerges(result.merges);
      this.chargeScoreFromMerges(result.merges, 1);

      // Spawn immediately after slide resolution so new tile appears before burst chain.
      this.spawnOneTile();

      // Force visual state refresh so all charge bars are correctly filled and score updates BEFORE bursts trigger.
      this.refreshAll();

      const continueTurnResolution = () => {
        const bursts = this.collectBurstTriggers(result.merges);
        this.coffeeBurstsThisInstance = 0;
        this.coffeeCoreGainsThisInstance = 0;
        this.coffeeInstanceStartIceCore = this.iceCore;
        this.resolveBurstQueue(bursts, () => {
          this.applyCoffeePassive();
          this.tickFreezeTurns();
          this.updateCustomer();
          this.advanceHeatPhaseTurn();
          this.advanceColdSnapPhaseTurn();
          this.normalizeIceState();

          const finishTurn = () => {
            this.checkLoseCondition(() => {
              this.refreshAll();
              this.isResolving = false;
            });
          };

          const checkColdEnded = () => {
            if (this.coldSnapPhaseEndedTriggered) {
              this.coldSnapPhaseEndedTriggered = false;
              this.playColdSnapFadesCutIn(finishTurn);
            } else {
              finishTurn();
            }
          };

          if (this.heatPhaseEndedTriggered) {
            this.heatPhaseEndedTriggered = false;
            this.playHeatFadesCutIn(checkColdEnded);
          } else {
            checkColdEnded();
          }
        });
      };

      const checkColdTrigger = () => {
        if (this.coldSnapPhaseTriggered) {
          this.coldSnapPhaseTriggered = false;
          this.playColdSnapCutIn(continueTurnResolution);
        } else {
          continueTurnResolution();
        }
      };

      if (this.heatPhaseTriggered) {
        this.heatPhaseTriggered = false;
        this.playHeatIntensifiesCutIn(checkColdTrigger);
      } else {
        checkColdTrigger();
      }
    });
  }

  applyMoveDecay(hadMerge = false) {
    if (this.coldSnapPhaseActive) {
      return;
    }

    if (this.heatPhaseActive) {
      this.iceCore = Math.max(0, this.iceCore - 2);
      return;
    }

    if (hadMerge) {
      return;
    }

    this.iceCore = Math.max(0, this.iceCore - 1);
  }

  checkSpecialPhaseProgression() {
    if (this.heatPhaseActive || this.coldSnapPhaseActive || this.turnCount === 0 || this.turnCount % this.heatPhaseMoveThreshold !== 0) {
      return;
    }

    const event = Phaser.Math.RND.pick(["heat", "cold"]);

    if (event === "heat") {
      this.heatPhaseActive = true;
      this.heatPhaseTriggered = true;
      this.heatPhaseMovesRemaining = this.heatPhaseDurationMoves;
      this.coffeePassiveInterval = 4;
      this.setMessage("Heat Intensifies! Ice Core drains -2 each slide. Coffee spreads every 4 slides.", "#ffbb88");
      this.activateHeatBoardOutline();
    } else {
      this.coldSnapPhaseActive = true;
      this.coldSnapPhaseTriggered = true;
      this.coldSnapPhaseMovesRemaining = this.coldSnapPhaseDurationMoves;
      this.setMessage("Cold Snap! No moving cost, but some tiles freeze.", "#aaeaff");
      this.activateColdBoardOutline();

      const freezeCount = Phaser.Math.Between(3, 4);
      for (let i = 0; i < freezeCount; i++) {
        this.applyIceFreezeGuard(true);
      }
    }
  }

  advanceHeatPhaseTurn() {
    if (!this.heatPhaseActive) {
      return;
    }

    this.heatPhaseMovesRemaining = Math.max(0, this.heatPhaseMovesRemaining - 1);
    if (this.heatPhaseMovesRemaining > 0) {
      return;
    }

    this.heatPhaseActive = false;
    this.heatPhaseEndedTriggered = true;
    this.coffeePassiveInterval = 3;
    this.deactivateHeatBoardOutline();
    this.setMessage("Heat surge fades. Ice Core drain and coffee spread return to normal.", "#ffd5aa");
  }

  advanceColdSnapPhaseTurn() {
    if (!this.coldSnapPhaseActive) {
      return;
    }

    this.coldSnapPhaseMovesRemaining = Math.max(0, this.coldSnapPhaseMovesRemaining - 1);
    if (this.coldSnapPhaseMovesRemaining > 0) {
      return;
    }

    this.coldSnapPhaseActive = false;
    this.coldSnapPhaseEndedTriggered = true;
    this.deactivateColdBoardOutline();
    this.setMessage("Cold Snap fades. Normal movement costs return.", "#cceeff");
  }

  activateHeatBoardOutline() {
    if (!this.heatBoardOutline || !this.heatBoardGlow) {
      return;
    }

    this.tweens.killTweensOf(this.heatBoardGlowOuter);
    this.tweens.killTweensOf(this.heatBoardGlow);
    this.tweens.killTweensOf(this.heatBoardOutline);

    if (this.heatBoardGlowOuter) {
      this.heatBoardGlowOuter.setVisible(true).setAlpha(0.1).setStrokeStyle(40, 0xff0000, 1);
    }
    this.heatBoardGlow.setVisible(true).setAlpha(0.3).setStrokeStyle(20, 0xff5500, 1);
    this.heatBoardOutline.setVisible(true).setAlpha(0.6).setStrokeStyle(8, 0xffaa00, 1);

    if (this.heatBoardGlowOuter) {
      this.tweens.add({
        targets: this.heatBoardGlowOuter,
        alpha: 0.4,
        duration: 400,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    this.tweens.add({
      targets: this.heatBoardGlow,
      alpha: 0.8,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.tweens.add({
      targets: this.heatBoardOutline,
      alpha: 1,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  deactivateHeatBoardOutline() {
    if (!this.heatBoardOutline || !this.heatBoardGlow) {
      return;
    }

    this.tweens.killTweensOf(this.heatBoardGlowOuter);
    this.tweens.killTweensOf(this.heatBoardGlow);
    this.tweens.killTweensOf(this.heatBoardOutline);

    const targets = [this.heatBoardGlow, this.heatBoardOutline];
    if (this.heatBoardGlowOuter) targets.push(this.heatBoardGlowOuter);

    this.tweens.add({
      targets,
      alpha: 0,
      duration: 260,
      ease: "Quad.easeOut",
      onComplete: () => {
        if (this.heatBoardGlowOuter) this.heatBoardGlowOuter.setVisible(false).setAlpha(0);
        this.heatBoardGlow.setVisible(false).setAlpha(0);
        this.heatBoardOutline.setVisible(false).setAlpha(0);
      },
    });
  }

  activateColdBoardOutline() {
    if (!this.coldBoardOutline || !this.coldBoardGlow) {
      return;
    }

    this.tweens.killTweensOf(this.coldBoardGlowOuter);
    this.tweens.killTweensOf(this.coldBoardGlow);
    this.tweens.killTweensOf(this.coldBoardOutline);

    if (this.coldBoardGlowOuter) {
      this.coldBoardGlowOuter.setVisible(true).setAlpha(0.1).setStrokeStyle(40, 0x0066ff, 1);
    }
    this.coldBoardGlow.setVisible(true).setAlpha(0.3).setStrokeStyle(20, 0x00aaff, 1);
    this.coldBoardOutline.setVisible(true).setAlpha(0.6).setStrokeStyle(8, 0x00ffff, 1);

    if (this.coldBoardGlowOuter) {
      this.tweens.add({
        targets: this.coldBoardGlowOuter,
        alpha: 0.4,
        duration: 400,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    this.tweens.add({
      targets: this.coldBoardGlow,
      alpha: 0.8,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.tweens.add({
      targets: this.coldBoardOutline,
      alpha: 1,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  deactivateColdBoardOutline() {
    if (!this.coldBoardOutline || !this.coldBoardGlow) {
      return;
    }

    this.tweens.killTweensOf(this.coldBoardGlowOuter);
    this.tweens.killTweensOf(this.coldBoardGlow);
    this.tweens.killTweensOf(this.coldBoardOutline);

    const targets = [this.coldBoardGlow, this.coldBoardOutline];
    if (this.coldBoardGlowOuter) targets.push(this.coldBoardGlowOuter);

    this.tweens.add({
      targets,
      alpha: 0,
      duration: 260,
      ease: "Quad.easeOut",
      onComplete: () => {
        if (this.coldBoardGlowOuter) this.coldBoardGlowOuter.setVisible(false).setAlpha(0);
        this.coldBoardGlow.setVisible(false).setAlpha(0);
        this.coldBoardOutline.setVisible(false).setAlpha(0);
      },
    });
  }

  playHeatFadesCutIn(done) {
    const { width, height } = this.scale;
    const minCutInDuration = 2000;
    const exitDuration = 220;
    let hasExited = false;
    let canExitForTime = false;
    let canExitForSfx = false;
    let minDurationTimer = null;
    let detachSfxCompleteListener = null;

    if (this.activeHeatCutInState && this.activeHeatCutInState.cleanup) {
      this.activeHeatCutInState.cleanup();
      this.activeHeatCutInState = null;
    }

    const beginExit = () => {
      if (hasExited || !canExitForTime || !canExitForSfx) {
        return;
      }

      hasExited = true;
      if (detachSfxCompleteListener) {
        detachSfxCompleteListener();
      }
      if (this.activeHeatCutInState) {
        this.activeHeatCutInState = null;
      }

      this.tweens.add({
        targets: [
          this.cutIn.stripe,
          this.cutIn.stripeAccent,
          this.cutIn.stripeAccentTop,
          this.cutIn.title,
          this.cutIn.subtitle,
          this.cutIn.sprite,
          this.cutIn.spriteShadow,
        ],
        y: "-=800",
        alpha: 0,
        duration: exitDuration + 100,
        ease: "Cubic.easeIn",
      });

      this.tweens.add({
        targets: this.cutIn.overlay,
        alpha: 0,
        duration: exitDuration + 100,
        delay: 40,
        onComplete: () => {
          this.cutIn.overlay.setVisible(false);
          this.cutIn.stripe.setVisible(false).setAngle(-2);
          this.cutIn.stripeAccent.setVisible(false).setAngle(-2);
          this.cutIn.stripeAccentTop.setVisible(false).setAngle(-2);
          this.cutIn.title.setVisible(false).setAlpha(1).setScale(1).setColor("#ffffff");
          this.cutIn.subtitle.setVisible(false).setAlpha(1).setScale(1).setColor("#d4e8f7");
          this.cutIn.sprite.setVisible(false).setAlpha(1).setAngle(0).clearTint();
          this.cutIn.spriteShadow.setVisible(false).setAlpha(0).setAngle(0).clearTint();

          this.cutIn.particles.forEach((p) => p.destroy());
          this.cutIn.particles = [];

          if (done) {
            done();
          }
        },
      });
    };

    const markSfxReady = () => {
      canExitForSfx = true;
      beginExit();
    };

    const cleanupCutInState = () => {
      if (minDurationTimer) {
        minDurationTimer.remove(false);
        minDurationTimer = null;
      }

      if (detachSfxCompleteListener) {
        detachSfxCompleteListener();
      }

      hasExited = true;
    };

    this.activeHeatCutInState = {
      cleanup: cleanupCutInState,
    };

    minDurationTimer = this.time.delayedCall(minCutInDuration, () => {
      minDurationTimer = null;
      canExitForTime = true;
      beginExit();
    });

    if (!this.registry.get("muteSfx") && this.sys && this.sys.isActive() && this.sound && this.cache.audio.exists("endEventSfx")) {
      if (!this.endEventSfx) {
        this.endEventSfx = this.sound.add("endEventSfx", { volume: 0.9 });
      }

      if (this.endEventSfx.isPlaying) {
        this.endEventSfx.stop();
      }

      this.endEventSfx.setVolume(0.9);
      this.endEventSfx.play({ volume: 0.9 });

      if (this.endEventSfx.isPlaying) {
        const onSfxComplete = () => {
          markSfxReady();
        };

        this.endEventSfx.once("complete", onSfxComplete);
        detachSfxCompleteListener = () => {
          if (!this.endEventSfx) {
            detachSfxCompleteListener = null;
            return;
          }

          this.endEventSfx.off("complete", onSfxComplete);
          detachSfxCompleteListener = null;
        };
      } else {
        canExitForSfx = true;
      }
    } else {
      canExitForSfx = true;
    }

    this.cutIn.particles.forEach((p) => p.destroy());
    this.cutIn.particles = [];

    this.cutIn.overlay.setVisible(true).setAlpha(0);
    this.tweens.add({
      targets: this.cutIn.overlay,
      alpha: 0.5,
      duration: 130,
    });

    this.cutIn.stripe
      .setVisible(true)
      .setFillStyle(0x0b253a, 0.95)
      .setPosition(width * 0.5, height + 120)
      .setDisplaySize(width + 100, 148)
      .setAngle(0)
      .setAlpha(1);

    this.cutIn.stripeAccent
      .setVisible(true)
      .setFillStyle(0x5ca3ff, 0.95)
      .setPosition(width * 0.5, height + 188)
      .setDisplaySize(width + 100, 5)
      .setAngle(0)
      .setAlpha(0.85);

    this.cutIn.stripeAccentTop
      .setVisible(true)
      .setFillStyle(0x82bfff, 0.92)
      .setPosition(width * 0.5, height + 52)
      .setDisplaySize(width + 100, 5)
      .setAngle(0)
      .setAlpha(0.9);

    this.cutIn.title
      .setVisible(true)
      .setText("Back to Normal!!")
      .setColor("#b8deff")
      .setPosition(width * 0.5, height + 98)
      .setAlpha(1)
      .setScale(0.9);

    this.cutIn.subtitle
      .setVisible(true)
      .setText("HEAT PHASE ENDED")
      .setColor("#8ac4ff")
      .setPosition(width * 0.5, height + 130)
      .setAlpha(0.95)
      .setScale(1);

    this.cutIn.sprite
      .setVisible(true)
      .setTexture("propIce")
      .setPosition(width * 0.5 - 260, height + 120)
      .setAlpha(0.95)
      .setAngle(-8)
      .setTint(0x9bd8ff);

    this.cutIn.spriteShadow
      .setVisible(true)
      .setTexture("propIce")
      .setPosition(width * 0.5 - 248, height + 136)
      .setAlpha(0.34)
      .setAngle(-8)
      .setTint(0x000000);

    const source = this.cutIn.sprite.texture.getSourceImage();
    const spriteW = source.width || 1;
    const spriteH = source.height || 1;
    const spriteRatio = Math.min(118 / spriteW, 136 / spriteH);
    this.cutIn.sprite.setScale(spriteRatio);

    for (let i = 0; i < 16; i += 1) {
      const ember = this.add
        .circle(width * 0.5 + Phaser.Math.Between(-290, 290), height + Phaser.Math.Between(20, 180), Phaser.Math.Between(2, 4), 0x9beaff, 0.8)
        .setDepth(252);
      this.cutIn.particles.push(ember);

      this.tweens.add({
        targets: ember,
        y: ember.y - Phaser.Math.Between(80, 180),
        x: ember.x + Phaser.Math.Between(-16, 16),
        alpha: 0,
        scale: 0.3,
        duration: Phaser.Math.Between(420, 760),
        delay: Phaser.Math.Between(0, 120),
        ease: "Cubic.easeOut",
      });
    }

    this.cameras.main.shake(220, 0.002);

    this.tweens.add({
      targets: [
        this.cutIn.stripe,
        this.cutIn.stripeAccent,
        this.cutIn.stripeAccentTop,
        this.cutIn.title,
        this.cutIn.subtitle,
        this.cutIn.sprite,
        this.cutIn.spriteShadow,
      ],
      y: "-=320",
      duration: 260,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: this.cutIn.title,
          scaleX: 1.04,
          scaleY: 1.04,
          duration: 140,
          yoyo: true,
          repeat: 1,
          ease: "Sine.easeInOut",
        });
      },
    });
  }

  playHeatIntensifiesCutIn(done) {
    if (!this.registry.get("muteSfx") && this.sys && this.sys.isActive() && this.sound) {
      this.sound.play("eventSfx", { volume: 0.9 });
    }
    const { width, height } = this.scale;
    const minCutInDuration = 3000;
    const exitDuration = 220;
    let hasExited = false;
    let canExitForTime = false;
    let canExitForSfx = false;
    let minDurationTimer = null;
    let detachSfxCompleteListener = null;

    if (this.activeHeatCutInState && this.activeHeatCutInState.cleanup) {
      this.activeHeatCutInState.cleanup();
      this.activeHeatCutInState = null;
    }

    const beginExit = () => {
      if (hasExited || !canExitForTime || !canExitForSfx) {
        return;
      }

      hasExited = true;
      if (detachSfxCompleteListener) {
        detachSfxCompleteListener();
      }
      if (this.activeHeatCutInState) {
        this.activeHeatCutInState = null;
      }

      this.tweens.add({
        targets: [
          this.cutIn.stripe,
          this.cutIn.stripeAccent,
          this.cutIn.stripeAccentTop,
          this.cutIn.title,
          this.cutIn.subtitle,
          this.cutIn.sprite,
          this.cutIn.spriteShadow,
        ],
        y: "-=800",
        alpha: 0,
        duration: exitDuration + 100,
        ease: "Cubic.easeIn",
      });

      this.tweens.add({
        targets: this.cutIn.overlay,
        alpha: 0,
        duration: exitDuration + 100,
        delay: 40,
        onComplete: () => {
          this.cutIn.overlay.setVisible(false);
          this.cutIn.stripe.setVisible(false).setAngle(-2);
          this.cutIn.stripeAccent.setVisible(false).setAngle(-2);
          this.cutIn.stripeAccentTop.setVisible(false).setAngle(-2);
          this.cutIn.title.setVisible(false).setAlpha(1).setScale(1).setColor("#ffffff");
          this.cutIn.subtitle.setVisible(false).setAlpha(1).setScale(1).setColor("#d4e8f7");
          this.cutIn.sprite.setVisible(false).setAlpha(1).setAngle(0).clearTint();
          this.cutIn.spriteShadow.setVisible(false).setAlpha(0).setAngle(0).clearTint();

          this.cutIn.particles.forEach((p) => p.destroy());
          this.cutIn.particles = [];

          if (done) {
            done();
          }
        },
      });
    };

    const markSfxReady = () => {
      canExitForSfx = true;
      beginExit();
    };

    const cleanupCutInState = () => {
      if (minDurationTimer) {
        minDurationTimer.remove(false);
        minDurationTimer = null;
      }

      if (detachSfxCompleteListener) {
        detachSfxCompleteListener();
      }

      hasExited = true;
    };

    this.activeHeatCutInState = {
      cleanup: cleanupCutInState,
    };

    minDurationTimer = this.time.delayedCall(minCutInDuration, () => {
      minDurationTimer = null;
      canExitForTime = true;
      beginExit();
    });

    if (!this.registry.get("muteSfx") && this.sys && this.sys.isActive() && this.sound && this.cache.audio.exists("heatIntensifiesSfx")) {
      if (!this.heatIntensifiesSfx) {
        this.heatIntensifiesSfx = this.sound.add("heatIntensifiesSfx", { volume: 0.9 });
      }

      if (this.heatIntensifiesSfx.isPlaying) {
        this.heatIntensifiesSfx.stop();
      }

      this.heatIntensifiesSfx.setVolume(0.9);
      this.heatIntensifiesSfx.play({ volume: 0.9 });

      if (this.heatIntensifiesSfx.isPlaying) {
        const onSfxComplete = () => {
          markSfxReady();
        };

        this.heatIntensifiesSfx.once("complete", onSfxComplete);
        detachSfxCompleteListener = () => {
          if (!this.heatIntensifiesSfx) {
            detachSfxCompleteListener = null;
            return;
          }

          this.heatIntensifiesSfx.off("complete", onSfxComplete);
          detachSfxCompleteListener = null;
        };
      } else {
        canExitForSfx = true;
      }
    } else {
      canExitForSfx = true;
    }

    this.cutIn.particles.forEach((p) => p.destroy());
    this.cutIn.particles = [];

    this.cutIn.overlay.setVisible(true).setAlpha(0);
    this.tweens.add({
      targets: this.cutIn.overlay,
      alpha: 0.5,
      duration: 130,
    });

    this.cutIn.stripe
      .setVisible(true)
      .setFillStyle(0x4a1e08, 0.95)
      .setPosition(width * 0.5, height + 120)
      .setDisplaySize(width + 100, 148)
      .setAngle(0)
      .setAlpha(1);

    this.cutIn.stripeAccent
      .setVisible(true)
      .setFillStyle(0xff8f2f, 0.95)
      .setPosition(width * 0.5, height + 188)
      .setDisplaySize(width + 100, 5)
      .setAngle(0)
      .setAlpha(0.85);

    this.cutIn.stripeAccentTop
      .setVisible(true)
      .setFillStyle(0xffc166, 0.92)
      .setPosition(width * 0.5, height + 52)
      .setDisplaySize(width + 100, 5)
      .setAngle(0)
      .setAlpha(0.9);

    this.cutIn.title
      .setVisible(true)
      .setText("Heat Intensifies!!")
      .setColor("#ffd39a")
      .setPosition(width * 0.5, height + 98)
      .setAlpha(1)
      .setScale(0.9);

    this.cutIn.subtitle
      .setVisible(true)
      .setText("ICE CORE DRAIN SPIKES")
      .setColor("#ffb066")
      .setPosition(width * 0.5, height + 130)
      .setAlpha(0.95)
      .setScale(1);

    this.cutIn.sprite
      .setVisible(true)
      .setTexture("propIce")
      .setPosition(width * 0.5 - 260, height + 120)
      .setAlpha(0.95)
      .setAngle(-8)
      .setTint(0xffb366);

    this.cutIn.spriteShadow
      .setVisible(true)
      .setTexture("propIce")
      .setPosition(width * 0.5 - 248, height + 136)
      .setAlpha(0.34)
      .setAngle(-8)
      .setTint(0x000000);

    const source = this.cutIn.sprite.texture.getSourceImage();
    const spriteW = source.width || 1;
    const spriteH = source.height || 1;
    const spriteRatio = Math.min(118 / spriteW, 136 / spriteH);
    this.cutIn.sprite.setScale(spriteRatio);

    for (let i = 0; i < 16; i += 1) {
      const ember = this.add
        .circle(width * 0.5 + Phaser.Math.Between(-290, 290), height + Phaser.Math.Between(20, 180), Phaser.Math.Between(2, 4), 0xff9d3a, 0.8)
        .setDepth(252);
      this.cutIn.particles.push(ember);

      this.tweens.add({
        targets: ember,
        y: ember.y - Phaser.Math.Between(80, 180),
        x: ember.x + Phaser.Math.Between(-16, 16),
        alpha: 0,
        scale: 0.3,
        duration: Phaser.Math.Between(420, 760),
        delay: Phaser.Math.Between(0, 120),
        ease: "Cubic.easeOut",
      });
    }

    this.cameras.main.shake(220, 0.0038);

    this.tweens.add({
      targets: [
        this.cutIn.stripe,
        this.cutIn.stripeAccent,
        this.cutIn.stripeAccentTop,
        this.cutIn.title,
        this.cutIn.subtitle,
        this.cutIn.sprite,
        this.cutIn.spriteShadow,
      ],
      y: "-=320",
      duration: 260,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: this.cutIn.title,
          scaleX: 1.04,
          scaleY: 1.04,
          duration: 140,
          yoyo: true,
          repeat: 1,
          ease: "Sine.easeInOut",
        });
      },
    });
  }

  playColdSnapFadesCutIn(done) {
    const { width, height } = this.scale;
    const minCutInDuration = 2000;
    const exitDuration = 220;
    let hasExited = false;
    let canExitForTime = false;
    let canExitForSfx = false;
    let minDurationTimer = null;
    let detachSfxCompleteListener = null;

    if (this.activeHeatCutInState && this.activeHeatCutInState.cleanup) {
      this.activeHeatCutInState.cleanup();
      this.activeHeatCutInState = null;
    }

    const beginExit = () => {
      if (hasExited || !canExitForTime || !canExitForSfx) {
        return;
      }

      hasExited = true;
      if (detachSfxCompleteListener) detachSfxCompleteListener();
      if (this.activeHeatCutInState) this.activeHeatCutInState = null;

      this.tweens.add({
        targets: [
          this.cutIn.stripe,
          this.cutIn.stripeAccent,
          this.cutIn.stripeAccentTop,
          this.cutIn.title,
          this.cutIn.subtitle,
          this.cutIn.sprite,
          this.cutIn.spriteShadow,
        ],
        y: "-=800",
        alpha: 0,
        duration: exitDuration + 100,
        ease: "Cubic.easeIn",
      });

      this.tweens.add({
        targets: this.cutIn.overlay,
        alpha: 0,
        duration: exitDuration + 100,
        delay: 40,
        onComplete: () => {
          this.cutIn.overlay.setVisible(false);
          this.cutIn.stripe.setVisible(false).setAngle(-2);
          this.cutIn.stripeAccent.setVisible(false).setAngle(-2);
          this.cutIn.stripeAccentTop.setVisible(false).setAngle(-2);
          this.cutIn.title.setVisible(false).setAlpha(1).setScale(1).setColor("#ffffff");
          this.cutIn.subtitle.setVisible(false).setAlpha(1).setScale(1).setColor("#d4e8f7");
          this.cutIn.sprite.setVisible(false).setAlpha(1).setAngle(0).clearTint();
          this.cutIn.spriteShadow.setVisible(false).setAlpha(0).setAngle(0).clearTint();

          this.cutIn.particles.forEach((p) => p.destroy());
          this.cutIn.particles = [];

          if (done) done();
        },
      });
    };

    const markSfxReady = () => {
      canExitForSfx = true;
      beginExit();
    };

    const cleanupCutInState = () => {
      if (minDurationTimer) {
        minDurationTimer.remove(false);
        minDurationTimer = null;
      }
      if (detachSfxCompleteListener) detachSfxCompleteListener();
      hasExited = true;
    };

    this.activeHeatCutInState = { cleanup: cleanupCutInState };

    minDurationTimer = this.time.delayedCall(minCutInDuration, () => {
      minDurationTimer = null;
      canExitForTime = true;
      beginExit();
    });

    if (!this.registry.get("muteSfx") && this.sys && this.sys.isActive() && this.sound && this.cache.audio.exists("endEventSfx")) {
      if (!this.endEventSfx) this.endEventSfx = this.sound.add("endEventSfx", { volume: 0.9 });
      if (this.endEventSfx.isPlaying) this.endEventSfx.stop();
      this.endEventSfx.setVolume(0.9);
      this.endEventSfx.play({ volume: 0.9 });

      if (this.endEventSfx.isPlaying) {
        const onSfxComplete = () => markSfxReady();
        this.endEventSfx.once("complete", onSfxComplete);
        detachSfxCompleteListener = () => {
          if (!this.endEventSfx) { detachSfxCompleteListener = null; return; }
          this.endEventSfx.off("complete", onSfxComplete);
          detachSfxCompleteListener = null;
        };
      } else {
        canExitForSfx = true;
      }
    } else {
      canExitForSfx = true;
    }

    this.cutIn.particles.forEach((p) => p.destroy());
    this.cutIn.particles = [];

    this.cutIn.overlay.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.cutIn.overlay, alpha: 0.5, duration: 130 });

    this.cutIn.stripe.setVisible(true).setFillStyle(0x0a1a2a, 0.95).setPosition(width * 0.5, height + 120).setDisplaySize(width + 100, 148).setAngle(0).setAlpha(1);
    this.cutIn.stripeAccent.setVisible(true).setFillStyle(0x5ca3ff, 0.95).setPosition(width * 0.5, height + 188).setDisplaySize(width + 100, 5).setAngle(0).setAlpha(0.85);
    this.cutIn.stripeAccentTop.setVisible(true).setFillStyle(0x82bfff, 0.92).setPosition(width * 0.5, height + 52).setDisplaySize(width + 100, 5).setAngle(0).setAlpha(0.9);

    this.cutIn.title.setVisible(true).setText("Back to Normal!!").setColor("#b8deff").setPosition(width * 0.5, height + 98).setAlpha(1).setScale(0.9);
    this.cutIn.subtitle.setVisible(true).setText("COLD SNAP ENDED").setColor("#8ac4ff").setPosition(width * 0.5, height + 130).setAlpha(0.95).setScale(1);

    this.cutIn.sprite.setVisible(true).setTexture("propIce").setPosition(width * 0.5 - 260, height + 120).setAlpha(0.95).setAngle(-8).setTint(0x9bd8ff);
    this.cutIn.spriteShadow.setVisible(true).setTexture("propIce").setPosition(width * 0.5 - 248, height + 136).setAlpha(0.34).setAngle(-8).setTint(0x000000);

    const source = this.cutIn.sprite.texture.getSourceImage();
    const spriteRatio = Math.min(118 / (source.width || 1), 136 / (source.height || 1));
    this.cutIn.sprite.setScale(spriteRatio);

    for (let i = 0; i < 16; i += 1) {
      const ember = this.add.circle(width * 0.5 + Phaser.Math.Between(-290, 290), height + Phaser.Math.Between(20, 180), Phaser.Math.Between(2, 4), 0x9beaff, 0.8).setDepth(252);
      this.cutIn.particles.push(ember);
      this.tweens.add({
        targets: ember,
        y: ember.y - Phaser.Math.Between(80, 180),
        x: ember.x + Phaser.Math.Between(-16, 16),
        alpha: 0,
        scale: 0.3,
        duration: Phaser.Math.Between(420, 760),
        delay: Phaser.Math.Between(0, 120),
        ease: "Cubic.easeOut",
      });
    }

    this.cameras.main.shake(220, 0.002);

    this.tweens.add({
      targets: [this.cutIn.stripe, this.cutIn.stripeAccent, this.cutIn.stripeAccentTop, this.cutIn.title, this.cutIn.subtitle, this.cutIn.sprite, this.cutIn.spriteShadow],
      y: "-=320",
      duration: 260,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({ targets: this.cutIn.title, scaleX: 1.04, scaleY: 1.04, duration: 140, yoyo: true, repeat: 1, ease: "Sine.easeInOut" });
      },
    });
  }

  playColdSnapCutIn(done) {
    if (!this.registry.get("muteSfx") && this.sys && this.sys.isActive() && this.sound) {
      this.sound.play("eventSfx", { volume: 0.9 });
    }
    const { width, height } = this.scale;
    const minCutInDuration = 3000;
    const exitDuration = 220;
    let hasExited = false;
    let canExitForTime = false;
    let canExitForSfx = false;
    let minDurationTimer = null;
    let detachSfxCompleteListener = null;

    if (this.activeHeatCutInState && this.activeHeatCutInState.cleanup) {
      this.activeHeatCutInState.cleanup();
      this.activeHeatCutInState = null;
    }

    const beginExit = () => {
      if (hasExited || !canExitForTime || !canExitForSfx) return;
      hasExited = true;
      if (detachSfxCompleteListener) detachSfxCompleteListener();
      if (this.activeHeatCutInState) this.activeHeatCutInState = null;

      this.tweens.add({
        targets: [
          this.cutIn.stripe,
          this.cutIn.stripeAccent,
          this.cutIn.stripeAccentTop,
          this.cutIn.title,
          this.cutIn.subtitle,
          this.cutIn.sprite,
          this.cutIn.spriteShadow,
        ],
        y: "-=800",
        alpha: 0,
        duration: exitDuration + 100,
        ease: "Cubic.easeIn",
      });

      this.tweens.add({
        targets: this.cutIn.overlay,
        alpha: 0,
        duration: exitDuration + 100,
        delay: 40,
        onComplete: () => {
          this.cutIn.overlay.setVisible(false);
          this.cutIn.stripe.setVisible(false).setAngle(-2);
          this.cutIn.stripeAccent.setVisible(false).setAngle(-2);
          this.cutIn.stripeAccentTop.setVisible(false).setAngle(-2);
          this.cutIn.title.setVisible(false).setAlpha(1).setScale(1).setColor("#ffffff");
          this.cutIn.subtitle.setVisible(false).setAlpha(1).setScale(1).setColor("#d4e8f7");
          this.cutIn.sprite.setVisible(false).setAlpha(1).setAngle(0).clearTint();
          this.cutIn.spriteShadow.setVisible(false).setAlpha(0).setAngle(0).clearTint();

          this.cutIn.particles.forEach((p) => p.destroy());
          this.cutIn.particles = [];

          if (done) done();
        },
      });
    };

    const markSfxReady = () => {
      canExitForSfx = true;
      beginExit();
    };

    const cleanupCutInState = () => {
      if (minDurationTimer) { minDurationTimer.remove(false); minDurationTimer = null; }
      if (detachSfxCompleteListener) detachSfxCompleteListener();
      hasExited = true;
    };

    this.activeHeatCutInState = { cleanup: cleanupCutInState };

    minDurationTimer = this.time.delayedCall(minCutInDuration, () => {
      minDurationTimer = null;
      canExitForTime = true;
      beginExit();
    });

    if (!this.registry.get("muteSfx") && this.sys && this.sys.isActive() && this.sound && this.cache.audio.exists("comboColdBreezeSfx")) {
      if (!this.coldSnapSfx) this.coldSnapSfx = this.sound.add("comboColdBreezeSfx", { volume: 0.9 });
      if (this.coldSnapSfx.isPlaying) this.coldSnapSfx.stop();
      this.coldSnapSfx.setVolume(0.9);
      this.coldSnapSfx.play({ volume: 0.9 });

      if (this.coldSnapSfx.isPlaying) {
        const onSfxComplete = () => markSfxReady();
        this.coldSnapSfx.once("complete", onSfxComplete);
        detachSfxCompleteListener = () => {
          if (!this.coldSnapSfx) { detachSfxCompleteListener = null; return; }
          this.coldSnapSfx.off("complete", onSfxComplete);
          detachSfxCompleteListener = null;
        };
      } else {
        canExitForSfx = true;
      }
    } else {
      canExitForSfx = true;
    }

    this.cutIn.particles.forEach((p) => p.destroy());
    this.cutIn.particles = [];

    this.cutIn.overlay.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.cutIn.overlay, alpha: 0.5, duration: 130 });

    this.cutIn.stripe.setVisible(true).setFillStyle(0x002244, 0.95).setPosition(width * 0.5, height + 120).setDisplaySize(width + 100, 148).setAngle(0).setAlpha(1);
    this.cutIn.stripeAccent.setVisible(true).setFillStyle(0x0088ff, 0.95).setPosition(width * 0.5, height + 188).setDisplaySize(width + 100, 5).setAngle(0).setAlpha(0.85);
    this.cutIn.stripeAccentTop.setVisible(true).setFillStyle(0x66ccff, 0.92).setPosition(width * 0.5, height + 52).setDisplaySize(width + 100, 5).setAngle(0).setAlpha(0.9);

    this.cutIn.title.setVisible(true).setText("Cold Snap!!").setColor("#aaddff").setPosition(width * 0.5, height + 98).setAlpha(1).setScale(0.9);
    this.cutIn.subtitle.setVisible(true).setText("TILES WILL FREEZE OVER").setColor("#66aaff").setPosition(width * 0.5, height + 130).setAlpha(0.95).setScale(1);

    this.cutIn.sprite.setVisible(true).setTexture("propIce").setPosition(width * 0.5 - 260, height + 120).setAlpha(0.95).setAngle(-8).setTint(0x66ccff);
    this.cutIn.spriteShadow.setVisible(true).setTexture("propIce").setPosition(width * 0.5 - 248, height + 136).setAlpha(0.34).setAngle(-8).setTint(0x000000);

    const source = this.cutIn.sprite.texture.getSourceImage();
    const spriteRatio = Math.min(118 / (source.width || 1), 136 / (source.height || 1));
    this.cutIn.sprite.setScale(spriteRatio);

    for (let i = 0; i < 16; i += 1) {
      const ember = this.add.circle(width * 0.5 + Phaser.Math.Between(-290, 290), height + Phaser.Math.Between(20, 180), Phaser.Math.Between(2, 4), 0xaaddff, 0.8).setDepth(252);
      this.cutIn.particles.push(ember);
      this.tweens.add({
        targets: ember,
        y: ember.y - Phaser.Math.Between(80, 180),
        x: ember.x + Phaser.Math.Between(-16, 16),
        alpha: 0,
        scale: 0.3,
        duration: Phaser.Math.Between(420, 760),
        delay: Phaser.Math.Between(0, 120),
        ease: "Cubic.easeOut",
      });
    }

    this.cameras.main.shake(220, 0.0038);

    this.tweens.add({
      targets: [this.cutIn.stripe, this.cutIn.stripeAccent, this.cutIn.stripeAccentTop, this.cutIn.title, this.cutIn.subtitle, this.cutIn.sprite, this.cutIn.spriteShadow],
      y: "-=320",
      duration: 260,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({ targets: this.cutIn.title, scaleX: 1.04, scaleY: 1.04, duration: 140, yoyo: true, repeat: 1, ease: "Sine.easeInOut" });
      },
    });
  }

  resolveIceMerges(merges) {
    merges.forEach((merge) => {
      if (merge.type !== "ice") {
        return;
      }

      const restore = 2 + Math.max(1, Math.floor(merge.resultTier * 0.5));
      this.iceCore = Math.min(this.iceCoreMax, this.iceCore + restore);
      this.applyIceFreezeGuard();
    });
  }

  chargeScoreFromMerges(merges, scoreMultiplier) {
    merges.forEach((merge) => {
      if (merge) {
        this.score += 2 * scoreMultiplier;
      }
    });
  }

  collectBurstTriggers(merges) {
    const bursts = [];
    const burstKeys = new Set();

    merges.forEach((merge) => {
      const threshold = this.burstThresholds[merge.type];
      if (!threshold || merge.type === "ice") {
        return;
      }

      const tile = this.board[merge.y][merge.x];
      if (!tile || this.freezeTurns[merge.y][merge.x] > 0) {
        return;
      }

      if ((tile.charge || 0) >= threshold) {
        bursts.push({ type: merge.type, x: merge.x, y: merge.y, power: tile.tier });
        burstKeys.add(`${merge.x},${merge.y}`);
      }
    });

    // Also trigger bursts for tiles that reached threshold through passives this turn
    // (for example: water-merge passive charging all coffee).
    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        if (burstKeys.has(`${x},${y}`)) {
          continue;
        }

        const tile = this.board[y][x];
        if (!tile || tile.type === "ice" || this.freezeTurns[y][x] > 0) {
          continue;
        }

        const threshold = this.burstThresholds[tile.type];
        if (!threshold) {
          continue;
        }

        if ((tile.charge || 0) >= threshold) {
          bursts.push({ type: tile.type, x, y, power: tile.tier });
          burstKeys.add(`${x},${y}`);
        }
      }
    }

    return bursts;
  }

  resolveBurstQueue(queue, onComplete, chainState = { coffeeFreshenPlayed: false }) {
    if (!queue.length) {
      const extraBursts = this.collectBurstTriggers([]);
      if (extraBursts.length > 0) {
        queue = extraBursts;
      } else {
        this.playFinalComboTierSfx(() => {
          onComplete();
        });
        return;
      }
    }

    const burst = queue.shift();

    const runBurstLogic = () => {
      this.playBurstPreShake(burst, () => {
        const afterPreShake = () => {
          const finishBurst = () => {
            const comboMultiplier = this.getFreshenComboBonus(burst.type);
            this.applySkill(burst.type, burst, chainState);

            const freshenBaseScore = burst.type === "coffee" ? 3 : 10;
            this.score += Math.round(freshenBaseScore * comboMultiplier);
            this.refreshAll();
            this.resolveBurstQueue(queue, onComplete, chainState);
          };

          if (burst.type === "cola") {
            this.playColaBombBurst(burst, finishBurst);
            return;
          }

          this.playSlotBurst(burst, finishBurst);
        };

        if (burst.type === "cola") {
          this.playColaPreShake(burst, afterPreShake);
        } else {
          afterPreShake();
        }
      });
    };

    if (burst.type === "coffee" && chainState.coffeeFreshenPlayed) {
      runBurstLogic();
      return;
    }

    if (burst.type === "coffee") {
      chainState.coffeeFreshenPlayed = true;
    }

    this.playFreshenCutIn(burst.type, runBurstLogic);
  }

  playBurstPreShake(burst, onDone) {
    const idx = burst.y * this.gridSize + burst.x;
    const spriteBase = this.tileSpritesBase[idx];
    const sprite = this.tileSprites[idx];
    const rect = this.cellRects[idx];

    if (!sprite || !sprite.visible) {
      onDone();
      return;
    }

    const origX = sprite.x;
    const origY = sprite.y;

    this.killTweensForObjects([rect, spriteBase, sprite]);
    this.resetTileVisualTransform(idx);

    if (rect) {
      rect.setStrokeStyle(3, 0xffe1a8, 1);
    }

    this.tweens.add({
      targets: [spriteBase, sprite],
      x: { from: origX - 1.5, to: origX + 1.5 },
      y: { from: origY - 0.8, to: origY + 0.8 },
      duration: 55,
      yoyo: true,
      repeat: 3,
      ease: "Sine.easeInOut",
      onComplete: () => {
        spriteBase.x = origX;
        spriteBase.y = origY;
        sprite.x = origX;
        sprite.y = origY;
        onDone();
      },
    });
  }

  playSlotBurst(burst, onDone) {
    const center = this.getCellCenter(burst.x, burst.y);
    const color = this.productColors[burst.type] || 0xffffff;

    const ring = this.add.circle(center.x, center.y, 10, color, 0.95).setDepth(240);
    const flash = this.add.rectangle(center.x, center.y, this.cellSize - 12, this.cellSize - 12, color, 0.35).setDepth(239);

    this.cameras.main.shake(120, 0.003);

    this.playSfx("popSfx", { volume: 0.5 });

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const dist = 40 + Math.random() * 30;
      const particle = this.add.circle(center.x, center.y, 4 + Math.random() * 4, color, 1).setDepth(241);

      this.tweens.add({
        targets: particle,
        x: center.x + Math.cos(angle) * dist,
        y: center.y + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.1,
        duration: 350 + Math.random() * 150,
        ease: "Cubic.easeOut",
        onComplete: () => {
          particle.destroy();
        }
      });
    }

    this.tweens.add({
      targets: ring,
      radius: 44,
      alpha: 0,
      duration: 170,
      ease: "Cubic.easeOut",
    });

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 170,
      ease: "Linear",
      onComplete: () => {
        this.removeBurstSourceTile(burst);
        ring.destroy();
        flash.destroy();
        onDone();
      },
    });
  }

  removeBurstSourceTile(burst) {
    if (!this.isInside(burst.x, burst.y)) {
      return;
    }

    this.board[burst.y][burst.x] = null;
    this.freezeTurns[burst.y][burst.x] = 0;
  }

  playColaBombBurst(burst, onDone) {
    const center = this.getCellCenter(burst.x, burst.y);
    const idx = burst.y * this.gridSize + burst.x;
    const sourceBase = this.tileSpritesBase[idx];
    const source = this.tileSprites[idx];
    const sourceRect = this.cellRects[idx];
    const shakeTargets = [sourceBase, source].filter(Boolean);

    const neighbors = [
      [burst.x + 1, burst.y],
      [burst.x - 1, burst.y],
      [burst.x, burst.y + 1],
      [burst.x, burst.y - 1],
    ];

    const affected = [];
    neighbors.forEach(([x, y]) => {
      if (!this.isInside(x, y)) {
        return;
      }

      const nIdx = y * this.gridSize + x;
      affected.push({
        x,
        y,
        rect: this.cellRects[nIdx],
        spriteBase: this.tileSpritesBase[nIdx],
        sprite: this.tileSprites[nIdx],
      });
    });

    if (sourceRect) {
      sourceRect.setStrokeStyle(3, 0xff6b6b, 1);
    }

    affected.forEach(({ rect }) => {
      if (rect) {
        rect.setStrokeStyle(3, 0xff5959, 1);
      }
    });

    const beatTimes = [0, 170, 340];
    let exploded = false;

    const triggerExplosion = () => {
      if (exploded || !this.sys || !this.sys.isActive()) {
        return;
      }
      exploded = true;

      this.playColaExplosionSfx();
      this.cameras.main.shake(320, 0.007);

      const blastRing = this.add.circle(center.x, center.y, 20, 0xf04949, 0).setStrokeStyle(4, 0xf04949, 0.95).setDepth(246);
      const blastFlash = this.add.rectangle(center.x, center.y, this.cellSize + 18, this.cellSize + 18, 0xff5f5f, 0.45).setDepth(245);

      this.tweens.add({
        targets: blastRing,
        radius: 120,
        alpha: 0,
        duration: 480,
        ease: "Cubic.easeOut",
        onComplete: () => {
          blastRing.destroy();
        },
      });

      this.tweens.add({
        targets: blastFlash,
        alpha: 0,
        duration: 300,
        ease: "Linear",
        onComplete: () => {
          blastFlash.destroy();
        },
      });

      affected.forEach(({ x, y, spriteBase, sprite }) => {
        const c = this.getCellCenter(x, y);

        if (spriteBase && spriteBase.visible) {
          spriteBase.setTint(0x101010);
        }

        if (sprite && sprite.visible) {
          sprite.setTint(0x080808);
        }

        for (let i = 0; i < 9; i += 1) {
          const dust = this.add
            .circle(c.x + Phaser.Math.Between(-8, 8), c.y + Phaser.Math.Between(-8, 8), Phaser.Math.Between(2, 4), 0x2a2a2a, 0.82)
            .setDepth(246);

          this.tweens.add({
            targets: dust,
            x: dust.x + Phaser.Math.Between(-30, 30),
            y: dust.y + Phaser.Math.Between(-26, 24),
            alpha: 0,
            scale: 0.3,
            duration: Phaser.Math.Between(520, 820),
            ease: "Quad.easeOut",
            onComplete: () => {
              dust.destroy();
            },
          });
        }

        const fadeTargets = [spriteBase, sprite].filter(Boolean);
        if (fadeTargets.length) {
          this.tweens.add({
            targets: fadeTargets,
            alpha: 0,
            duration: 620,
            ease: "Cubic.easeIn",
            onComplete: () => {
              if (spriteBase && spriteBase.active) {
                spriteBase.clearTint();
              }
              if (sprite && sprite.active) {
                sprite.clearTint();
              }
            },
          });
        }
      });

      const sourceFadeTargets = [sourceBase, source].filter(Boolean);
      this.tweens.add({
        targets: sourceFadeTargets,
        alpha: 0,
        duration: 650,
        ease: "Cubic.easeIn",
        onComplete: () => {
          this.removeBurstSourceTile(burst);

          if (sourceBase && sourceBase.active) {
            sourceBase.clearTint();
          }
          if (source && source.active) {
            source.clearTint();
          }

          onDone();
        },
      });
    };

    beatTimes.forEach((delay, i) => {
      this.time.delayedCall(delay, () => {
        if (this.gameOver || !this.sys || !this.sys.isActive()) {
          return;
        }

        const shakeAmount = 1.5 + i * 0.5;
        shakeTargets.forEach((target) => {
          // Kill prior shake tweens so each tick starts from a clean centered pose.
          this.tweens.killTweensOf(target);
          target.x = center.x;
          target.y = center.y;

          this.tweens.add({
            targets: target,
            x: { from: center.x - shakeAmount, to: center.x + shakeAmount },
            y: { from: center.y - 0.35, to: center.y + 0.35 },
            duration: 55,
            yoyo: true,
            repeat: 0,
            ease: "Sine.easeInOut",
            onComplete: () => {
              target.x = center.x;
              target.y = center.y;
            },
          });
        });

        this.cameras.main.shake(45, 0.0012 + i * 0.0002);

        this.playSfx("uiClickSfx", { volume: 0.58 + i * 0.08 });

        if (i === beatTimes.length - 1) {
          // Trigger explosion right after the final tick beat to keep audio/visual timing locked.
          this.time.delayedCall(90, triggerExplosion);
        }
      });
    });
  }

  playColaPreShake(burst, onDone) {
    const adjacents = [
      [burst.x + 1, burst.y],
      [burst.x - 1, burst.y],
      [burst.x, burst.y + 1],
      [burst.x, burst.y - 1],
    ];

    const allSprites = [];
    const affectedRects = [];

    adjacents.forEach(([x, y]) => {
      if (!this.isInside(x, y)) {
        return;
      }

      const idx = y * this.gridSize + x;
      const spriteBase = this.tileSpritesBase[idx];
      const sprite = this.tileSprites[idx];
      const rect = this.cellRects[idx];

      if (spriteBase && spriteBase.visible) {
        allSprites.push(spriteBase);
      }

      if (sprite && sprite.visible) {
        allSprites.push(sprite);
      }

      if (rect) {
        affectedRects.push(rect);
      }
    });

    affectedRects.forEach((rect) => {
      rect.setStrokeStyle(3, 0xff4444, 1);
    });

    if (!allSprites.length) {
      this.time.delayedCall(200, () => {
        onDone();
      });
      return;
    }

    let completed = 0;

    allSprites.forEach((sprite) => {
      const origX = sprite.x;

      this.tweens.killTweensOf(sprite);

      this.tweens.add({
        targets: sprite,
        x: origX + 4,
        duration: 40,
        yoyo: true,
        repeat: 5,
        ease: "Sine.easeInOut",
        onComplete: () => {
          sprite.x = origX;
          completed += 1;

          if (completed === allSprites.length) {
            onDone();
          }
        },
      });
    });
  }

  playFreshenCutIn(type, done) {
    const { width, height } = this.scale;

    const skillNames = {
      water: "PURIFY FLOW",
      juice: "SWEET CHARGE",
      tea: "GRID CLEANSE",
      cola: "CARBON BURST",
      coffee: "OVERCLOCK BREW",
    };

    const stripeColors = {
      water: 0x1a3a5c,
      juice: 0x4a2a0a,
      tea: 0x1a3a1a,
      cola: 0x4a0a0a,
      coffee: 0x2a1a0a,
    };

    const accentColors = {
      water: 0x66b8ff,
      juice: 0xff8f5a,
      tea: 0x78c764,
      cola: 0xf04949,
      coffee: 0x9b6a4c,
    };

    const color = this.productColors[type];
    const accent = accentColors[type] || 0xffffff;
    const stripeColor = stripeColors[type] || 0x1c2f3f;

    if (this.sys && this.sys.isActive() && this.sound && this.cache.audio.exists("freshenUpSfx")) {
      // Keep cut-in feedback crisp by restarting this one-shot sound per cut-in.
      if (!this.freshenUpSfx) {
        this.freshenUpSfx = this.sound.add("freshenUpSfx", { volume: 0.78 });
      }

      if (this.freshenUpSfx.isPlaying) {
        this.freshenUpSfx.stop();
      }

      this.freshenUpSfx.setVolume(0.78);
      if (!this.registry.get("muteSfx")) {
        this.freshenUpSfx.play({ volume: 0.78 });
      }
    }

    // Clean up previous particles
    this.cutIn.particles.forEach((p) => p.destroy());
    this.cutIn.particles = [];

    // Setup overlay
    this.cutIn.overlay.setVisible(true).setAlpha(0);
    this.tweens.add({
      targets: this.cutIn.overlay,
      alpha: 0.45,
      duration: 120,
    });

    // Setup stripe - starts scaled to 0 vertically, slashes in
    this.cutIn.stripe
      .setVisible(true)
      .setFillStyle(stripeColor, 0.94)
      .setPosition(width * 0.5, height * 0.5)
      .setDisplaySize(width + 40, 0)
      .setAlpha(1);

    this.cutIn.stripeAccent
      .setVisible(true)
      .setFillStyle(accent, 0.9)
      .setPosition(width * 0.5, height * 0.5 + 48)
      .setAlpha(0);

    this.cutIn.stripeAccentTop
      .setVisible(true)
      .setFillStyle(accent, 0.9)
      .setPosition(width * 0.5, height * 0.5 - 48)
      .setAlpha(0);

    // Setup text - starts offscreen right
    this.cutIn.title
      .setVisible(true)
      .setText("FRESHEN UP")
      .setPosition(width + 200, height * 0.5 - 18)
      .setAlpha(1)
      .setScale(1);

    this.cutIn.subtitle
      .setVisible(true)
      .setText(skillNames[type])
      .setPosition(width + 200, height * 0.5 + 22)
      .setAlpha(1)
      .setColor(`#${accent.toString(16).padStart(6, '0')}`);

    // Setup sprite - starts offscreen left
    const spriteKey = this.itemSpriteKeys[type];
    this.cutIn.sprite
      .setVisible(true)
      .setTexture(spriteKey)
      .setPosition(-80, height * 0.5)
      .setAlpha(1)
      .setAngle(-30);

    this.cutIn.spriteShadow
      .setVisible(true)
      .setTexture(spriteKey)
      .setPosition(-68, height * 0.5 + 16)
      .setAlpha(0.34)
      .setAngle(-30);

    const source = this.cutIn.sprite.texture.getSourceImage();
    const spriteW = source.width || 1;
    const spriteH = source.height || 1;
    const spriteRatio = Math.min(130 / spriteW, 140 / spriteH);
    this.cutIn.sprite.setScale(spriteRatio);

    // Camera shake per product
    const shakeIntensity = type === "cola" ? 0.005 : 0.0025;
    const shakeDuration = type === "cola" ? 350 : 200;
    this.cameras.main.shake(shakeDuration, shakeIntensity);

    // Animate stripe expanding
    this.tweens.add({
      targets: this.cutIn.stripe,
      displayHeight: 110,
      duration: 140,
      ease: "Back.easeOut",
      onComplete: () => {
        // Accent lines flash in
        this.tweens.add({
          targets: [this.cutIn.stripeAccent, this.cutIn.stripeAccentTop],
          alpha: 0.9,
          duration: 80,
        });

        // Sprite slides in from left
        this.tweens.add({
          targets: this.cutIn.sprite,
          x: width * 0.18,
          y: height * 0.5 - 14,
          duration: 200,
          ease: "Back.easeOut",
        });

        // Title and subtitle slide in from right
        this.tweens.add({
          targets: this.cutIn.title,
          x: width * 0.55,
          duration: 220,
          ease: "Cubic.easeOut",
        });

        this.tweens.add({
          targets: this.cutIn.subtitle,
          x: width * 0.55,
          duration: 250,
          ease: "Cubic.easeOut",
        });

        // Spawn per-product particles
        this.spawnCutInParticles(type);

        // Per-product sprite animation
        this.playCutInSpriteAnim(type);

        // Hold, then exit
        this.time.delayedCall(480, () => {
          this.exitCutIn(done);
        });
      },
    });
  }

  spawnCutInParticles(type) {
    const { width, height } = this.scale;
    const centerY = height * 0.5;
    const color = this.productColors[type];

    if (type === "water") {
      for (let i = 0; i < 12; i += 1) {
        const x = Phaser.Math.Between(60, width - 60);
        const y = centerY + Phaser.Math.Between(-40, 40);
        const drop = this.add.circle(x, y, Phaser.Math.Between(2, 5), 0x66b8ff, 0.7).setDepth(252);
        this.cutIn.particles.push(drop);
        this.tweens.add({
          targets: drop,
          y: y + Phaser.Math.Between(20, 50),
          alpha: 0,
          scaleX: 0.5,
          scaleY: 1.8,
          duration: Phaser.Math.Between(400, 700),
          ease: "Quad.easeIn",
        });
      }
    }

    if (type === "juice") {
      for (let i = 0; i < 10; i += 1) {
        const x = Phaser.Math.Between(80, width - 80);
        const y = centerY + Phaser.Math.Between(-35, 35);
        const spark = this.add.star(x, y, 4, 2, 5, 0xffcc66, 0.8).setDepth(252);
        this.cutIn.particles.push(spark);
        this.tweens.add({
          targets: spark,
          y: y - Phaser.Math.Between(15, 40),
          alpha: 0,
          angle: Phaser.Math.Between(-90, 90),
          scale: 0.2,
          duration: Phaser.Math.Between(350, 600),
          ease: "Sine.easeOut",
        });
      }
    }

    if (type === "tea") {
      for (let i = 0; i < 8; i += 1) {
        const x = Phaser.Math.Between(40, width - 40);
        const y = centerY + Phaser.Math.Between(-30, 30);
        const leaf = this.add.ellipse(x, y, 8, 4, 0x78c764, 0.65).setDepth(252).setAngle(Phaser.Math.Between(-45, 45));
        this.cutIn.particles.push(leaf);
        this.tweens.add({
          targets: leaf,
          x: x + Phaser.Math.Between(-30, 30),
          y: y - Phaser.Math.Between(20, 50),
          alpha: 0,
          angle: leaf.angle + Phaser.Math.Between(-90, 90),
          duration: Phaser.Math.Between(500, 800),
          ease: "Sine.easeOut",
        });
      }
    }

    if (type === "cola") {
      for (let i = 0; i < 3; i += 1) {
        const cx = width * 0.18 + Phaser.Math.Between(-20, 20);
        const cy = centerY + Phaser.Math.Between(-10, 10);
        const ring = this.add.circle(cx, cy, 8, 0xf04949, 0).setStrokeStyle(2, 0xf04949, 0.9).setDepth(252);
        this.cutIn.particles.push(ring);
        this.tweens.add({
          targets: ring,
          radius: 35 + i * 12,
          alpha: 0,
          duration: 350 + i * 80,
          ease: "Cubic.easeOut",
          delay: i * 60,
        });
      }

      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI * 2 * i) / 6;
        const sx = width * 0.18;
        const sy = centerY;
        const shard = this.add.rectangle(sx, sy, 4, 10, 0xff6644, 0.85).setDepth(252).setAngle(Phaser.Math.RadToDeg(angle));
        this.cutIn.particles.push(shard);
        this.tweens.add({
          targets: shard,
          x: sx + Math.cos(angle) * 55,
          y: sy + Math.sin(angle) * 55,
          alpha: 0,
          duration: 350,
          ease: "Cubic.easeOut",
          delay: 60,
        });
      }
    }

    if (type === "coffee") {
      for (let i = 0; i < 6; i += 1) {
        const x = Phaser.Math.Between(40, width - 40);
        const y = centerY + Phaser.Math.Between(-35, 35);
        const w = Phaser.Math.Between(12, 40);
        const glitch = this.add.rectangle(x, y, w, 3, 0x9b6a4c, 0.6).setDepth(252);
        this.cutIn.particles.push(glitch);
        this.tweens.add({
          targets: glitch,
          x: x + Phaser.Math.Between(-20, 20),
          alpha: 0,
          scaleX: Phaser.Math.FloatBetween(0.3, 2),
          duration: Phaser.Math.Between(200, 500),
          ease: "Steps(4)",
          delay: Phaser.Math.Between(0, 150),
        });
      }
    }
  }

  playCutInSpriteAnim(type) {
    const sprite = this.cutIn.sprite;

    if (type === "water") {
      this.tweens.add({
        targets: sprite,
        scaleY: sprite.scaleY * 1.04,
        scaleX: sprite.scaleX * 0.97,
        duration: 200,
        yoyo: true,
        repeat: 1,
        ease: "Sine.easeInOut",
      });
    }

    if (type === "juice") {
      this.tweens.add({
        targets: sprite,
        y: sprite.y - 8,
        duration: 160,
        yoyo: true,
        repeat: 2,
        ease: "Quad.easeOut",
      });
    }

    if (type === "tea") {
      this.tweens.add({
        targets: sprite,
        angle: { from: -38, to: -22 },
        duration: 250,
        yoyo: true,
        repeat: 1,
        ease: "Sine.easeInOut",
      });
    }

    if (type === "cola") {
      this.tweens.add({
        targets: sprite,
        angle: { from: -40, to: -20 },
        duration: 60,
        yoyo: true,
        repeat: 6,
        ease: "Sine.easeInOut",
      });
      this.tweens.add({
        targets: sprite,
        scale: sprite.scaleX * 1.15,
        duration: 120,
        yoyo: true,
        ease: "Back.easeOut",
      });
    }

    if (type === "coffee") {
      this.tweens.add({
        targets: sprite,
        angle: { from: -34, to: -26 },
        duration: 36,
        yoyo: true,
        repeat: 5,
        ease: "Bounce.easeInOut",
      });
    }
  }

  exitCutIn(done) {
    const { width } = this.scale;

    // Everything exits in different directions
    this.tweens.add({
      targets: [this.cutIn.sprite, this.cutIn.spriteShadow],
      x: -120,
      angle: -45, // slant back slightly as it exits
      alpha: 0,
      duration: 200,
      ease: "Cubic.easeIn",
    });

    this.tweens.add({
      targets: [this.cutIn.title, this.cutIn.subtitle],
      x: width + 200,
      alpha: 0,
      duration: 200,
      ease: "Cubic.easeIn",
    });

    this.tweens.add({
      targets: this.cutIn.stripe,
      displayHeight: 0,
      alpha: 0,
      duration: 180,
      delay: 60,
      ease: "Cubic.easeIn",
    });

    this.tweens.add({
      targets: [this.cutIn.stripeAccent, this.cutIn.stripeAccentTop],
      alpha: 0,
      duration: 120,
    });

    this.tweens.add({
      targets: this.cutIn.overlay,
      alpha: 0,
      duration: 200,
      delay: 80,
      onComplete: () => {
        this.cutIn.overlay.setVisible(false);
        this.cutIn.stripe.setVisible(false);
        this.cutIn.stripeAccent.setVisible(false);
        this.cutIn.stripeAccentTop.setVisible(false);
        this.cutIn.title.setVisible(false).setAlpha(1);
        this.cutIn.subtitle.setVisible(false).setAlpha(1);
        this.cutIn.sprite.setVisible(false).setAlpha(1).setAngle(0);
        this.cutIn.spriteShadow.setVisible(false).setAlpha(0).setAngle(0);

        this.cutIn.particles.forEach((p) => p.destroy());
        this.cutIn.particles = [];

        done();
      },
    });
  }

  applySkill(type, burst = null, chainState = null) {
    if (this.customerActive && type === this.customerWantedType) {
      this.satisfyCustomer();
    }

    if (type === "water") {
      this.chargeAllWaterBy(1);
      this.setMessage("Water burst: all water charged +1.", "#9fd4ff");
      return;
    }

    if (type === "juice") {
      this.applyJuiceBurst(burst);
      this.setMessage("Juice burst: charged adjacent slots.", "#ffc4a8");
      return;
    }

    if (type === "tea") {
      const converted = this.convertAllTea();
      this.setMessage(`Tea burst: all tea converted to ${converted}.`, "#b8efaf");
      return;
    }

    if (type === "cola") {
      this.applyColaBurst(burst);
      this.setMessage("Cola burst: exploded surrounding slots.", "#ffb3b3");
      return;
    }

    if (type === "coffee") {
      this.coffeeBurstsThisInstance += 1;

      if (this.coffeeCoreGainsThisInstance < 3) {
        const maxCoffeeGainCore = Math.min(this.iceCoreMax, this.coffeeInstanceStartIceCore + 3);
        const beforeCore = this.iceCore;
        this.iceCore = Math.min(maxCoffeeGainCore, this.iceCore + 1);

        if (this.iceCore > beforeCore) {
          this.coffeeCoreGainsThisInstance += 1;
          this.setMessage(`Coffee burst: Ice Core +1 (${this.coffeeCoreGainsThisInstance}/3 this instance).`, "#ddc0aa");
        } else {
          this.coffeeCoreGainsThisInstance = 3;
          this.setMessage("Coffee burst: bonus cap reached for this instance.", "#ddc0aa");
        }
      } else {
        this.setMessage("Coffee burst: bonus cap reached for this instance.", "#ddc0aa");
      }
    }
  }

  updateCustomer() {
    if (this.customerActive) {
      return;
    }

    if (this.customerCooldown > 0) {
      this.customerCooldown -= 1;
      return;
    }

    this.spawnCustomer();
  }

  spawnCustomer() {
    this.customerActive = true;

    const drinks = ["water", "juice", "tea", "cola", "coffee"];
    this.customerWantedType = Phaser.Utils.Array.GetRandom(drinks);

    // Scaling is now handled statically in createRightPanel
    // Randomize the character sprite
    const customerKeys = ["student2", "student3", "student4"];
    const chosenKey = Phaser.Utils.Array.GetRandom(customerKeys);
    this.customerSprite.setTexture(chosenKey);

    // Recalculate half-body scaling in case the new image has different dimensions
    if (this.customerSprite.height) {
      const halfBodyHeight = this.customerSprite.height * 0.48;
      this.customerSprite.setScale(95 / halfBodyHeight);
    } else {
      this.customerSprite.setScale(0.45);
    }

    this.customerSprite.x = this.customerSpriteStartX || (this.customerSpriteBaseX + 110);
    this.customerSprite.y = this.customerSpriteBaseY || 66;

    this.customerSprite.setVisible(true).setAlpha(0);
    this.customerBubble.setVisible(false).setAlpha(0).setScale(0);
    this.customerText.setVisible(false).setAlpha(0).setScale(0);

    const drinkNames = {
      water: "Water",
      juice: "Juice",
      tea: "Tea",
      cola: "Cola",
      coffee: "Coffee",
    };

    this.customerText.setText(`I need a ${drinkNames[this.customerWantedType]}!`);

    this.tweens.add({
      targets: this.customerSprite,
      alpha: 1,
      duration: 300,
    });

    if (this.customerBobTween) {
      this.customerBobTween.stop();
    }

    // Bobbing tween (walk animation) - runs for 1200ms
    this.customerBobTween = this.tweens.add({
      targets: this.customerSprite,
      y: (this.customerSpriteBaseY || 66) - 4,
      duration: 150,
      yoyo: true,
      repeat: 3,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.customerSprite.y = this.customerSpriteBaseY || 66;
        this.customerBobTween = null;
      }
    });

    // Walk-in tween (X movement)
    this.tweens.add({
      targets: this.customerSprite,
      x: this.customerSpriteBaseX || (this.customerSprite.x - 110),
      duration: 1200,
      ease: "Linear",
      onComplete: () => {
        this.customerBubble.setVisible(true);
        this.customerText.setVisible(true);
        this.tweens.add({
          targets: [this.customerBubble, this.customerText],
          alpha: 1,
          scaleX: 1,
          scaleY: 1,
          duration: 300,
          ease: "Back.easeOut",
        });
      }
    });
  }

  satisfyCustomer() {
    if (!this.customerActive) return;

    this.customerActive = false;
    this.customerWantedType = null;
    this.customerCooldown = Phaser.Math.Between(5, 10);

    this.customerText.setText("Thanks!");

    this.score += 300;
    this.iceCore = Math.min(this.iceCoreMax, this.iceCore + 2);
    this.setMessage("Customer satisfied! Score +300, Ice Core +2.", "#a8ffb2");

    this.time.delayedCall(1200, () => {
      this.tweens.add({
        targets: [this.customerBubble, this.customerText],
        alpha: 0,
        duration: 300,
        onComplete: () => {
          this.customerBubble.setVisible(false);
          this.customerText.setVisible(false);
        }
      });

      if (this.customerBobTween) {
        this.customerBobTween.stop();
      }

      this.customerBobTween = this.tweens.add({
        targets: this.customerSprite,
        y: (this.customerSpriteBaseY || 66) - 4,
        duration: 150,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });

      this.tweens.add({
        targets: this.customerSprite,
        x: this.customerSpriteBaseX - 110,
        duration: 1200,
        ease: "Linear",
        onComplete: () => {
          this.customerSprite.setVisible(false);
          if (this.customerBobTween) {
            this.customerBobTween.stop();
            this.customerBobTween = null;
          }
          this.customerSprite.y = this.customerSpriteBaseY || 66;
        }
      });
    });
  }

  applyJuiceBurst(burst) {
    if (!burst) {
      return;
    }

    const targets = [
      [burst.x + 1, burst.y],
      [burst.x - 1, burst.y],
      [burst.x, burst.y + 1],
      [burst.x, burst.y - 1],
    ];

    targets.forEach(([x, y]) => {
      if (!this.isInside(x, y)) {
        return;
      }

      const tile = this.board[y][x];
      if (!tile || this.freezeTurns[y][x] > 0) {
        return;
      }

      if (tile.type === "ice") {
        this.iceCore = Math.min(this.iceCoreMax, this.iceCore + 1);
        return;
      }

      const cap = this.getChargeCapForType(tile.type);
      tile.charge = Math.min(cap, (tile.charge || 0) + 1);
    });
  }

  convertAllTea() {
    const counts = { water: 0, juice: 0, cola: 0 };

    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const tile = this.board[y][x];
        if (tile && counts[tile.type] !== undefined) {
          counts[tile.type] += 1;
        }
      }
    }

    let bestType = "water";
    let bestCount = 0;

    Object.entries(counts).forEach(([product, count]) => {
      if (count > bestCount) {
        bestCount = count;
        bestType = product;
      }
    });

    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const tile = this.board[y][x];
        if (tile && tile.type === "tea" && this.freezeTurns[y][x] <= 0) {
          this.board[y][x] = { type: bestType, tier: 1, charge: 0 };
          this.freezeTurns[y][x] = 0;
        }
      }
    }

    return bestType;
  }

  makeMergeReadyPair() {
    const pairs = this.getAdjacentPairs().filter((pair) => {
      const a = this.board[pair.a.y][pair.a.x];
      const b = this.board[pair.b.y][pair.b.x];

      if ((a && a.type === "ice") || (b && b.type === "ice")) {
        return false;
      }

      return true;
    });

    if (!pairs.length) {
      return;
    }

    const pair = Phaser.Utils.Array.GetRandom(pairs);
    const a = this.board[pair.a.y][pair.a.x];
    const b = this.board[pair.b.y][pair.b.x];

    if (a && b) {
      b.type = a.type;
      b.tier = a.tier;
      b.charge = a.charge || 0;
      return;
    }

    if (a && !b) {
      this.board[pair.b.y][pair.b.x] = { type: a.type, tier: a.tier, charge: a.charge || 0 };
      return;
    }

    if (!a && b) {
      this.board[pair.a.y][pair.a.x] = { type: b.type, tier: b.tier, charge: b.charge || 0 };
    }
  }

  applyColaBurst(burst) {
    if (!burst) {
      return;
    }

    // Source tile is removed by playSlotBurst after the pre-shake and explosion finish.
    const targets = [
      [burst.x + 1, burst.y],
      [burst.x - 1, burst.y],
      [burst.x, burst.y + 1],
      [burst.x, burst.y - 1],
    ];

    targets.forEach(([x, y]) => {
      if (!this.isInside(x, y)) {
        return;
      }

      const tile = this.board[y][x];
      if (!tile || this.freezeTurns[y][x] > 0) {
        return;
      }

      if (tile.type === "ice") {
        const prevCore = this.iceCore;
        this.iceCore = Math.max(0, this.iceCore - 3);
        if (prevCore > 0 && this.iceCore <= 0) {
          this.iceMeltCause = "cola";
        }
        this.playIceHurtFlash(x, y);
        return;
      }

      this.board[y][x] = null;
      this.freezeTurns[y][x] = 0;
    });
  }

  playIceHurtFlash(x, y) {
    if (!this.isInside(x, y) || !this.sys || !this.sys.isActive()) {
      return;
    }

    const idx = y * this.gridSize + x;
    const center = this.getCellCenter(x, y);
    const rect = this.cellRects[idx];
    const spriteBase = this.tileSpritesBase[idx];
    const sprite = this.tileSprites[idx];

    if (rect) {
      rect.setStrokeStyle(3, 0xff5757, 1);
    }

    const hurtOutline = this.add
      .rectangle(center.x, center.y, this.cellSize - 8, this.cellSize - 8, 0xff5757, 0)
      .setStrokeStyle(3, 0xff5757, 1)
      .setDepth(245)
      .setAlpha(0);

    const targets = [hurtOutline];
    if (spriteBase && spriteBase.visible) {
      targets.push(spriteBase);
      spriteBase.setTint(0xff8a8a);
    }
    if (sprite && sprite.visible) {
      targets.push(sprite);
      sprite.setTint(0xff8a8a);
    }

    this.cameras.main.shake(90, 0.0018);

    this.tweens.add({
      targets,
      alpha: (target) => (target === hurtOutline ? 1 : target.alpha),
      duration: 110,
      yoyo: true,
      ease: "Sine.easeInOut",
      onComplete: () => {
        if (spriteBase && spriteBase.active) {
          spriteBase.clearTint();
        }
        if (sprite && sprite.active) {
          sprite.clearTint();
        }
        if (hurtOutline && hurtOutline.active) {
          hurtOutline.destroy();
        }

        const tile = this.board[y] && this.board[y][x];
        if (rect && tile && tile.type === "ice") {
          rect.setStrokeStyle(2, this.productColors.ice, 1);
        }
      },
    });
  }

  applyCoffeePassive() {
    const coffees = this.getCoffeeTiles();
    if (!coffees.length) {
      return;
    }

    coffees.forEach(({ tile }) => {
      tile.coffeeSpreadCounter = (tile.coffeeSpreadCounter || 0) + 1;
    });

    const ready = coffees.filter(({ tile }) => (tile.coffeeSpreadCounter || 0) >= this.coffeePassiveInterval);
    if (!ready.length) {
      return;
    }

    const source = Phaser.Utils.Array.GetRandom(ready);
    // Reset once threshold is reached to avoid delayed surprise spread on later turns.
    this.resetAllCoffeeSpreadCounters();

    if (source && this.convertRandomSlotToCoffee(source)) {
      this.setMessage("Coffee passive: one coffee spread. Counters reset.", "#ddc0aa");
    }
  }

  getCoffeeTiles() {
    const coffees = [];
    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const tile = this.board[y][x];
        if (tile && tile.type === "coffee" && this.freezeTurns[y][x] <= 0) {
          coffees.push({ x, y, tile });
        }
      }
    }

    return coffees;
  }

  convertRandomSlotToCoffee(sourceCoffee = null) {
    const candidates = [];

    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const tile = this.board[y][x];
        if (!tile) {
          continue;
        }

        if (tile && tile.type === "ice") {
          continue;
        }

        if (tile && tile.type === "coffee") {
          continue;
        }

        if ((tile.tier ?? 1) !== 1) {
          continue;
        }

        if (this.freezeTurns[y][x] > 0) {
          continue;
        }

        candidates.push({ x, y });
      }
    }

    if (!candidates.length) {
      return false;
    }

    const chosen = Phaser.Utils.Array.GetRandom(candidates);
    const previousTile = this.board[chosen.y][chosen.x];
    const sourceTile = sourceCoffee && sourceCoffee.tile ? sourceCoffee.tile : null;
    const clonedTier = Math.max(1, sourceTile && sourceTile.tier ? sourceTile.tier : 1);
    const clonedCharge = sourceTile ? sourceTile.charge || 0 : 0;

    this.board[chosen.y][chosen.x] = {
      type: "coffee",
      tier: clonedTier,
      charge: Math.min(this.getChargeCapForType("coffee"), clonedCharge),
      coffeeSpreadCounter: 0,
    };
    this.freezeTurns[chosen.y][chosen.x] = 0;

    this.playCoffeeSpreadTransformEffect(chosen.x, chosen.y, previousTile, sourceTile);
    return true;
  }

  playCoffeeSpreadTransformEffect(x, y, previousTile, sourceTile) {
    if (!this.sys || !this.sys.isActive()) {
      return;
    }

    const idx = y * this.gridSize + x;
    const center = this.getCellCenter(x, y);
    const rect = this.cellRects[idx];
    const spriteBase = this.tileSpritesBase[idx];
    const sprite = this.tileSprites[idx];
    const oldType = previousTile && previousTile.type ? previousTile.type : null;

    this.refreshBoardView();

    if (rect) {
      rect.setStrokeStyle(3, 0x9b6a4c, 1);
    }

    const flash = this.add.circle(center.x, center.y, 10, 0x9b6a4c, 0.34).setDepth(236);

    const ring = this.add.circle(center.x, center.y, 12, 0x9b6a4c, 0).setStrokeStyle(2, 0x9b6a4c, 0.85).setDepth(237);

    this.tweens.add({
      targets: ring,
      radius: 36,
      alpha: 0,
      duration: 280,
      ease: "Cubic.easeOut",
      onComplete: () => {
        ring.destroy();
      },
    });

    this.tweens.add({
      targets: flash,
      radius: 30,
      alpha: 0,
      duration: 260,
      ease: "Sine.easeOut",
      onComplete: () => {
        flash.destroy();
      },
    });

    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8;
      const particle = this.add.circle(center.x, center.y, 2 + Math.random() * 1.8, 0x9b6a4c, 0.78).setDepth(238);
      this.tweens.add({
        targets: particle,
        x: center.x + Math.cos(angle) * (18 + Math.random() * 16),
        y: center.y + Math.sin(angle) * (18 + Math.random() * 16),
        alpha: 0,
        scale: 0.4,
        duration: 260 + Math.random() * 90,
        ease: "Cubic.easeOut",
        onComplete: () => {
          particle.destroy();
        },
      });
    }

    if (oldType && this.itemSpriteKeys[oldType]) {
      const oldSprite = this.add.image(center.x, center.y, this.itemSpriteKeys[oldType]).setDepth(239).setAlpha(0.9);
      this.placeTileSprite(oldSprite, oldType);
      this.tweens.add({
        targets: oldSprite,
        scaleX: oldSprite.scaleX * 1.16,
        scaleY: oldSprite.scaleY * 1.16,
        angle: 16,
        alpha: 0,
        duration: 240,
        ease: "Cubic.easeIn",
        onComplete: () => {
          oldSprite.destroy();
        },
      });
    }

    const cloneSprite = this.add.image(center.x, center.y, this.itemSpriteKeys.coffee).setDepth(240).setAlpha(0);
    this.placeTileSprite(cloneSprite, "coffee");
    cloneSprite.setScale(cloneSprite.scaleX * 0.72, cloneSprite.scaleY * 0.72);
    cloneSprite.setTint(0xd5b08f);

    this.tweens.add({
      targets: cloneSprite,
      alpha: 1,
      scaleX: cloneSprite.scaleX / 0.72,
      scaleY: cloneSprite.scaleY / 0.72,
      angle: { from: -10, to: 0 },
      duration: 260,
      ease: "Back.easeOut",
      onComplete: () => {
        cloneSprite.destroy();
      },
    });

    if (sourceTile && spriteBase && sprite) {
      const cap = this.getChargeCapForType("coffee");
      const ratio = Phaser.Math.Clamp((sourceTile.charge || 0) / cap, 0, 1);

      if (ratio <= 0) {
        sprite.setVisible(false);
        sprite.setCrop();
      } else {
        const source = sprite.texture.getSourceImage();
        const sourceHeight = source.height || 1;
        const sourceWidth = source.width || 1;
        const cropHeight = Math.max(1, sourceHeight * ratio);
        const cropY = sourceHeight - cropHeight;
        sprite.setVisible(true);
        sprite.setCrop(0, cropY, sourceWidth, cropHeight);
      }
      spriteBase.setAlpha(0.6);
      sprite.setAlpha(1);
    }

    this.tweens.add({
      targets: [spriteBase, sprite],
      scaleX: sprite ? sprite.scaleX * 1.07 : 1,
      scaleY: sprite ? sprite.scaleY * 1.07 : 1,
      duration: 120,
      yoyo: true,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.resetTileVisualTransform(idx);
      },
    });
  }

  chargeAllCoffeeBy(amount = 1) {
    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const tile = this.board[y][x];
        if (!tile || tile.type !== "coffee" || this.freezeTurns[y][x] > 0) {
          continue;
        }

        const cap = this.getChargeCapForType("coffee");
        tile.charge = Math.min(cap, (tile.charge || 0) + amount);
      }
    }
  }

  chargeAllWaterBy(amount = 1) {
    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const tile = this.board[y][x];
        if (!tile || tile.type !== "water" || this.freezeTurns[y][x] > 0) {
          continue;
        }

        const cap = this.getChargeCapForType("water");
        tile.charge = Math.min(cap, (tile.charge || 0) + amount);
      }
    }
  }

  resetAllCoffeeSpreadCounters() {
    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const tile = this.board[y][x];
        if (tile && tile.type === "coffee") {
          tile.coffeeSpreadCounter = 0;
        }
      }
    }
  }

  addIceMeltCount(amount) {
    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const tile = this.board[y][x];
        if (!tile || tile.type !== "ice") {
          continue;
        }

        tile.charge = Math.min(this.iceChargeMax, (tile.charge || 0) + amount);
      }
    }
  }

  hasTypeOnBoard(type) {
    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const tile = this.board[y][x];
        if (tile && tile.type === type) {
          return true;
        }
      }
    }

    return false;
  }

  applyIceFreezeGuard(isFromColdSnap = false) {
    const candidates = [];

    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const tile = this.board[y][x];
        if (tile && tile.type !== "ice" && this.freezeTurns[y][x] <= 0) {
          candidates.push({ x, y });
        }
      }
    }

    if (!candidates.length) {
      return;
    }

    const chosen = Phaser.Utils.Array.GetRandom(candidates);
    if (isFromColdSnap) {
      this.freezeTurns[chosen.y][chosen.x] = this.coldSnapPhaseDurationMoves;
    } else {
      this.freezeTurns[chosen.y][chosen.x] = 2;
    }
  }

  tickFreezeTurns() {
    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        if (this.freezeTurns[y][x] > 0) {
          this.freezeTurns[y][x] -= 1;

          if (this.freezeTurns[y][x] === 0) {
            const idx = y * this.gridSize + x;
            const freezeOverlay = this.freezeOverlays[idx];
            const freezeText = this.freezeTexts[idx];

            if (freezeText) {
              freezeText.setText("");
            }

            if (freezeOverlay && freezeOverlay.visible) {
              this.tweens.add({
                targets: freezeOverlay,
                alpha: 0,
                duration: 400,
                ease: "Quad.easeOut",
                onComplete: () => {
                  if (freezeOverlay.active) {
                    freezeOverlay.setVisible(false);
                    freezeOverlay.setAlpha(0.8);
                  }
                },
              });
            }
          }
        }
      }
    }
  }

  getAdjacentPairs() {
    const pairs = [];

    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        if (x + 1 < this.gridSize) {
          pairs.push({ a: { x, y }, b: { x: x + 1, y } });
        }
        if (y + 1 < this.gridSize) {
          pairs.push({ a: { x, y }, b: { x, y: y + 1 } });
        }
      }
    }

    return pairs;
  }

  slideAndMerge(direction) {
    const dirMap = {
      left: { dx: -1, dy: 0 },
      right: { dx: 1, dy: 0 },
      up: { dx: 0, dy: -1 },
      down: { dx: 0, dy: 1 },
    };

    const { dx, dy } = dirMap[direction];
    const order = this.getTraversalOrder(direction);
    const merged = Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(false));

    let moved = false;
    const merges = [];
    const actions = [];

    for (let step = 0; step < this.gridSize; step += 1) {
      let passMoved = false;

      order.forEach(({ x, y }) => {
        const tile = this.board[y][x];
        if (!tile || this.freezeTurns[y][x] > 0) {
          return;
        }

        const nx = x + dx;
        const ny = y + dy;
        if (!this.isInside(nx, ny)) {
          return;
        }

        const next = this.board[ny][nx];

        if (!next) {
          const fillRatio = this.getTileFillRatio(tile);
          this.board[ny][nx] = tile;
          this.board[y][x] = null;

          this.freezeTurns[ny][nx] = this.freezeTurns[y][x];
          this.freezeTurns[y][x] = 0;

          actions.push({ type: tile.type, fromX: x, fromY: y, toX: nx, toY: ny, fillRatio });

          passMoved = true;
          moved = true;
          return;
        }

        if (merged[ny][nx]) {
          return;
        }

        // if (next.type === tile.type && tile.type !== "coffee") {
        if (next.type === tile.type && tile.type !== "coffee" && this.freezeTurns[ny][nx] <= 0) {
          const fillRatio = this.getTileFillRatio(tile);
          const higher = Math.max(next.tier, tile.tier);
          const lower = Math.min(next.tier, tile.tier);
          const combinedTier = higher + lower;
          const combinedCharge = Math.min(
            this.getChargeCapForType(tile.type),
            Math.max(next.charge || 0, tile.charge || 0) + 1,
          );

          this.board[ny][nx] = {
            type: tile.type,
            tier: combinedTier,
            charge: combinedCharge,
            coffeeSpreadCounter:
              tile.type === "coffee"
                ? Math.min(next.coffeeSpreadCounter || 0, tile.coffeeSpreadCounter || 0)
                : undefined,
          };
          this.board[y][x] = null;

          this.freezeTurns[ny][nx] = Math.max(this.freezeTurns[ny][nx], this.freezeTurns[y][x]);
          this.freezeTurns[y][x] = 0;

          merged[ny][nx] = true;
          merges.push({ type: tile.type, resultTier: combinedTier, x: nx, y: ny });
          actions.push({ type: tile.type, fromX: x, fromY: y, toX: nx, toY: ny, merge: true, fillRatio });

          passMoved = true;
          moved = true;
        }
      });

      if (!passMoved) {
        break;
      }
    }

    return { moved, merges, actions };
  }

  getTraversalOrder(direction) {
    const order = [];

    if (direction === "left") {
      for (let y = 0; y < this.gridSize; y += 1) {
        for (let x = 1; x < this.gridSize; x += 1) {
          order.push({ x, y });
        }
      }
      return order;
    }

    if (direction === "right") {
      for (let y = 0; y < this.gridSize; y += 1) {
        for (let x = this.gridSize - 2; x >= 0; x -= 1) {
          order.push({ x, y });
        }
      }
      return order;
    }

    if (direction === "up") {
      for (let y = 1; y < this.gridSize; y += 1) {
        for (let x = 0; x < this.gridSize; x += 1) {
          order.push({ x, y });
        }
      }
      return order;
    }

    for (let y = this.gridSize - 2; y >= 0; y -= 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        order.push({ x, y });
      }
    }
    return order;
  }

  hasLegalMove() {
    return (
      this.canMoveInDirection("left") ||
      this.canMoveInDirection("right") ||
      this.canMoveInDirection("up") ||
      this.canMoveInDirection("down")
    );
  }

  canMoveInDirection(direction) {
    const dirMap = {
      left: { dx: -1, dy: 0 },
      right: { dx: 1, dy: 0 },
      up: { dx: 0, dy: -1 },
      down: { dx: 0, dy: 1 },
    };

    const { dx, dy } = dirMap[direction];
    const order = this.getTraversalOrder(direction);

    for (let i = 0; i < order.length; i += 1) {
      const { x, y } = order[i];
      const tile = this.board[y][x];
      if (!tile || this.freezeTurns[y][x] > 0) {
        continue;
      }

      const nx = x + dx;
      const ny = y + dy;
      if (!this.isInside(nx, ny)) {
        continue;
      }

      const next = this.board[ny][nx];
      if (!next || (next.type === tile.type && tile.type !== "coffee" && this.freezeTurns[ny][nx] <= 0)) {
        return true;
      }
    }

    return false;
  }

  checkLoseCondition(onComplete) {
    const done = () => {
      if (onComplete) {
        onComplete();
      }
    };

    if (this.gameOver) {
      done();
      return;
    }

    this.normalizeIceState();

    if (!this.hasAnyIceTile()) {
      this.iceCore = 0;
      this.gameOver = true;
      this.setMessage("Ice tile melted. Press RESTART.", "#ff9f9f");
      this.cameras.main.shake(260, 0.004);
      done();
      return;
    }

    if (this.iceCore <= 0) {
      this.gameOver = true;
      this.playIceMeltAnimation(() => {
        this.setMessage("Ice Core melted. Press RESTART.", "#ff9f9f");
        done();
      });
      return;
    }

    if (this.getEmptyCells().length === 0 && !this.hasLegalMove()) {
      this.triggerDeadlockGameOver();
      done();
      return;
    }

    done();
  }

  playIceMeltAnimation(onDone) {
    let icePos = null;

    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        if (this.board[y][x] && this.board[y][x].type === "ice") {
          icePos = { x, y };
          break;
        }
      }

      if (icePos) {
        break;
      }
    }

    if (!icePos) {
      onDone();
      return;
    }

    const idx = icePos.y * this.gridSize + icePos.x;
    const strokes = this.tileSpritesStrokes[idx];
    const spriteBase = this.tileSpritesBase[idx];
    const sprite = this.tileSprites[idx];
    const center = this.getCellCenter(icePos.x, icePos.y);
    const meltedByCola = this.iceMeltCause === "cola";

    this.iceMeltCause = null;

    this.cameras.main.shake(400, 0.005);

    const origX = sprite.x;

    this.tweens.add({
      targets: [...strokes, spriteBase, sprite],
      x: "+=4",
      duration: 50,
      yoyo: true,
      repeat: 7,
      ease: "Sine.easeInOut",
      onComplete: () => {
        strokes[0].x = origX - 1;
        strokes[1].x = origX + 1;
        strokes[2].x = origX;
        strokes[3].x = origX;
        spriteBase.x = origX;
        sprite.x = origX;

        if (meltedByCola) {
          const burnFlash = this.add.rectangle(center.x, center.y, this.cellSize - 8, this.cellSize - 8, 0x2a0f0f, 0.25).setDepth(240);

          [...strokes, spriteBase, sprite].forEach((target) => {
            if (target && target.setTint) {
              target.setTint(0x111111);
            }
          });

          for (let i = 0; i < 16; i += 1) {
            const dust = this.add
              .circle(center.x + Phaser.Math.Between(-8, 8), center.y + Phaser.Math.Between(-6, 8), Phaser.Math.Between(2, 4), 0x2b2b2b, 0.8)
              .setDepth(241);

            this.tweens.add({
              targets: dust,
              x: dust.x + Phaser.Math.Between(-36, 36),
              y: dust.y + Phaser.Math.Between(-24, 30),
              alpha: 0,
              scale: 0.35,
              duration: Phaser.Math.Between(500, 760),
              ease: "Quad.easeOut",
              onComplete: () => {
                dust.destroy();
              },
            });
          }

          this.tweens.add({
            targets: burnFlash,
            alpha: 0,
            duration: 520,
            ease: "Quad.easeOut",
            onComplete: () => {
              burnFlash.destroy();
            },
          });

          this.tweens.add({
            targets: [...strokes, spriteBase, sprite],
            scaleX: 0,
            scaleY: 0,
            alpha: 0,
            duration: 620,
            ease: "Cubic.easeIn",
            onComplete: () => {
              this.board[icePos.y][icePos.x] = null;
              this.freezeTurns[icePos.y][icePos.x] = 0;
              strokes.forEach((s) => s.clearTint().setVisible(false).setAlpha(0.6).setScale(1));
              spriteBase.clearTint().setVisible(false).setAlpha(1).setScale(1);
              sprite.clearTint().setVisible(false).setAlpha(1).setScale(1);
              this.refreshAll();
              onDone();
            },
          });
          return;
        }

        const drip1 = this.add.circle(center.x - 10, center.y + 10, 5, 0x79ddff, 0.85).setDepth(240);
        const drip2 = this.add.circle(center.x + 10, center.y + 10, 5, 0x79ddff, 0.85).setDepth(240);
        const drip3 = this.add.circle(center.x, center.y + 6, 4, 0x79ddff, 0.7).setDepth(240);

        this.tweens.add({
          targets: [drip1, drip2, drip3],
          y: "+=45",
          alpha: 0,
          scaleX: 0.4,
          scaleY: 2.2,
          duration: 550,
          ease: "Quad.easeIn",
          onComplete: () => {
            drip1.destroy();
            drip2.destroy();
            drip3.destroy();
          },
        });

        this.tweens.add({
          targets: [...strokes, spriteBase, sprite],
          scaleX: 0,
          scaleY: 0,
          alpha: 0,
          duration: 450,
          ease: "Cubic.easeIn",
          onComplete: () => {
            this.board[icePos.y][icePos.x] = null;
            this.freezeTurns[icePos.y][icePos.x] = 0;
            strokes.forEach(s => s.setVisible(false).setAlpha(0.6).setScale(1));
            spriteBase.setVisible(false).setAlpha(1).setScale(1);
            sprite.setVisible(false).setAlpha(1).setScale(1);
            this.refreshAll();
            onDone();
          },
        });
      },
    });
  }

  triggerDeadlockGameOver() {
    this.gameOver = true;
    this.setMessage("No possible moves on a full board. Press RESTART.", "#ff9f9f");
    this.cameras.main.shake(260, 0.004);
  }

  hasAnyIceTile() {
    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const tile = this.board[y][x];
        if (tile && tile.type === "ice") {
          return true;
        }
      }
    }

    return false;
  }

  normalizeIceState() {
    const iceTiles = [];

    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const tile = this.board[y][x];
        if (tile && tile.type === "ice") {
          iceTiles.push({ x, y, tile });
        }
      }
    }

    if (!iceTiles.length) {
      this.iceCore = 0;
      return;
    }

    if (iceTiles.length === 1) {
      return;
    }

    // Keep only one ice tile if future logic ever creates duplicates.
    const [keeper, ...extras] = iceTiles;
    extras.forEach(({ x, y }) => {
      this.board[y][x] = null;
      this.freezeTurns[y][x] = 0;
    });

    if (keeper.tile.charge == null) {
      keeper.tile.charge = 0;
    }
  }

  refreshAll() {
    if (!this.hasAnyTile()) {
      this.ensureInitialIceTile();
    }

    this.refreshBoardView();
    this.refreshHud();
  }

  hasAnyTile() {
    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        if (this.board[y][x]) {
          return true;
        }
      }
    }

    return false;
  }

  refreshBoardView() {
    if (!this.sys || !this.sys.isActive()) {
      return;
    }

    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const idx = y * this.gridSize + x;
        const tile = this.board[y][x];

        const rect = this.cellRects[idx];
        const strokes = this.tileSpritesStrokes[idx];
        const spriteBase = this.tileSpritesBase[idx];
        const sprite = this.tileSprites[idx];
        const freezeText = this.freezeTexts[idx];
        const freezeOverlay = this.freezeOverlays[idx];

        if (!tile) {
          rect.setFillStyle(0x1c2a36, 1);
          rect.setStrokeStyle(2, 0x395365, 1);
          spriteBase.setVisible(false).setAlpha(0.6).setAngle(0).setScale(1);
          sprite.setVisible(false).setAlpha(1).setAngle(0).setScale(1);
          strokes.forEach(s => s.setVisible(false));
          freezeText.setText("");
          if (freezeOverlay) freezeOverlay.setVisible(false);
          continue;
        }

        const color = this.productColors[tile.type] || 0x8fa7ba;
        rect.setFillStyle(0x1c2a36, 1);
        rect.setStrokeStyle(2, color, 1);

        let ratio;

        if (tile.type === "ice") {
          ratio = Phaser.Math.Clamp(this.iceCore / this.iceCoreMax, 0, 1);
        } else {
          const charge = tile.charge || 0;
          const cap = this.getChargeCapForType(tile.type);
          ratio = Phaser.Math.Clamp(charge / cap, 0, 1);
        }

        strokes.forEach(s => this.placeTileSprite(s, tile.type));
        this.placeTileSprite(spriteBase, tile.type);
        this.placeTileSprite(sprite, tile.type);
        spriteBase.setAlpha(0.6).setAngle(0);
        sprite.setAlpha(1).setAngle(0);

        const source = sprite.texture.getSourceImage();
        const sourceHeight = source.height || 1;
        const sourceWidth = source.width || 1;

        if (ratio <= 0) {
          sprite.setVisible(false);
          sprite.setCrop();
        } else {
          sprite.setVisible(true);
          const cropHeight = Math.max(1, sourceHeight * ratio);
          const cropY = sourceHeight - cropHeight;
          sprite.setCrop(0, cropY, sourceWidth, cropHeight);
        }

        freezeText.setText(this.freezeTurns[y][x] > 0 ? "F" : "");

        if (this.freezeTurns[y][x] > 0) {
          if (freezeOverlay) {
            freezeOverlay.setVisible(true);
            const source = freezeOverlay.texture.getSourceImage();
            const ratio = Math.min(54 / (source.width || 1), 66 / (source.height || 1));
            freezeOverlay.setScale(ratio * 1.15);
            if (!this.tweens.isTweening(freezeOverlay)) {
              freezeOverlay.setAlpha(0.8);
            }
          }
        } else {
          if (freezeOverlay && !this.tweens.isTweening(freezeOverlay)) {
            freezeOverlay.setVisible(false);
          }
        }
      }
    }
  }

  placeTileSprite(sprite, type) {
    if (!this.isTileSpriteUsable(sprite)) {
      return;
    }

    sprite.setTexture(this.itemSpriteKeys[type]);
    sprite.setVisible(true);

    const source = sprite.texture.getSourceImage();
    const width = source.width || 1;
    const height = source.height || 1;
    const ratio = Math.min(54 / width, 66 / height);
    sprite.setScale(ratio);
  }

  refreshHud() {
    this.iceCoreText.setText(`ICE CORE ${this.iceCore}/${this.iceCoreMax}`);
    this.scoreText.setText(`Score: ${this.score}`);
    this.turnText.setText(`Moves: ${this.turnCount}`);

    const ratio = Phaser.Math.Clamp(this.iceCore / this.iceCoreMax, 0, 1);
    this.iceCoreBar.setDisplaySize(196 * ratio, 14);

    const coreColor = this.iceCore <= 5 ? 0xff7f7f : this.iceCore <= 10 ? 0xffd77f : 0x79ddff;
    this.iceCoreBar.setFillStyle(coreColor, 1);
  }

  animateActions(actions, merges, onComplete) {
    this.cleanupTransientAnimationState(true);

    const moving = actions.filter((action) => action.fromX !== action.toX || action.fromY !== action.toY);
    if (!moving.length) {
      if (merges.length) {
        this.pulseMergedSlots(merges, () => {
          this.refreshAll();
          onComplete();
        });
      } else {
        this.refreshAll();
        onComplete();
      }
      return;
    }

    // Consolidate multi-step moves into single smooth animations per tile.
    // Each pass of slideAndMerge generates 1-cell steps; we merge them so a
    // tile that travels 3 cells gets ONE fluid tween instead of 3 choppy ones.
    const consolidated = new Map();

    moving.forEach((action) => {
      const key = `${action.toX},${action.toY}`;
      const fromKey = `${action.fromX},${action.fromY}`;

      // Check if a previous action ended where this one starts
      let origin = null;
      for (const [k, entry] of consolidated) {
        if (k === fromKey) {
          origin = entry;
          break;
        }
      }

      if (origin) {
        // Extend: keep the original start, update destination
        consolidated.delete(`${origin.toX},${origin.toY}`);
        consolidated.set(key, {
          type: action.type,
          fromX: origin.fromX,
          fromY: origin.fromY,
          toX: action.toX,
          toY: action.toY,
          merge: action.merge || origin.merge,
          fillRatio: origin.fillRatio,
        });
      } else {
        consolidated.set(key, { ...action });
      }
    });

    const smoothMoves = Array.from(consolidated.values());
    this.isSlideAnimating = true;

    // Render destination board state, then hide destination cells so the
    // moving temp sprites are the only visible movers during the tween.
    this.refreshBoardView();
    smoothMoves.forEach((action) => {
      const idx = action.toY * this.gridSize + action.toX;
      const rect = this.cellRects[idx];
      const strokes = this.tileSpritesStrokes[idx];
      const spriteBase = this.tileSpritesBase[idx];
      const sprite = this.tileSprites[idx];
      const freezeText = this.freezeTexts[idx];
      const freezeOverlay = this.freezeOverlays[idx];

      if (rect) {
        rect.setFillStyle(0x1c2a36, 1);
        rect.setStrokeStyle(2, 0x395365, 1);
      }
      if (strokes) {
        strokes.forEach((s) => s.setVisible(false));
      }
      if (spriteBase) {
        spriteBase.setVisible(false);
      }
      if (sprite) {
        sprite.setVisible(false);
      }
      if (freezeText) {
        freezeText.setText("");
      }
      if (freezeOverlay) {
        freezeOverlay.setVisible(false);
      }
    });

    smoothMoves.forEach((action) => {
      const idx = action.fromY * this.gridSize + action.fromX;
      if (this.tileSpritesBase[idx]) this.tileSpritesBase[idx].setVisible(false);
      if (this.tileSprites[idx]) this.tileSprites[idx].setVisible(false);
      if (this.tileSpritesStrokes[idx]) {
        this.tileSpritesStrokes[idx].forEach((s) => s.setVisible(false));
      }
    });

    let completed = 0;
    const moveBatchSprites = [];

    smoothMoves.forEach((action) => {
      const from = this.getCellCenter(action.fromX, action.fromY);
      const to = this.getCellCenter(action.toX, action.toY);

      const tempBase = this.add
        .image(from.x, from.y, this.itemSpriteKeys[action.type])
        .setDepth(219)
        .setTint(0x7a8794)
        .setAlpha(0.42);
      const temp = this.add.image(from.x, from.y, this.itemSpriteKeys[action.type]).setDepth(220);
      const tempStrokes = [];
      const strokeOffsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (let i = 0; i < strokeOffsets.length; i += 1) {
        const sx = strokeOffsets[i][0];
        const sy = strokeOffsets[i][1];
        const stroke = this.add
          .image(from.x + sx, from.y + sy, this.itemSpriteKeys[action.type])
          .setDepth(219)
          .setTint(0x8da1b3)
          .setAlpha(0.34);
        tempStrokes.push(stroke);
      }

      const source = temp.texture.getSourceImage();
      const ratio = Math.min(54 / (source.width || 1), 66 / (source.height || 1));
      temp.setScale(ratio);
      tempBase.setScale(ratio);
      tempStrokes.forEach((stroke) => {
        stroke.setScale(ratio);
      });

      const tempFillRatio = Phaser.Math.Clamp(action.fillRatio ?? 0, 0, 1);
      if (tempFillRatio <= 0) {
        // Keep full silhouette moving; hide fill when charge is empty.
        temp.setVisible(false);
        temp.setCrop();
        tempStrokes.forEach((stroke) => {
          stroke.setCrop();
          stroke.setAlpha(0.3);
        });
      } else if (tempFillRatio < 1) {
        const sourceHeight = source.height || 1;
        const sourceWidth = source.width || 1;
        const cropHeight = Math.max(1, sourceHeight * tempFillRatio);
        const cropY = sourceHeight - cropHeight;
        temp.setVisible(true);
        temp.setCrop(0, cropY, sourceWidth, cropHeight);
        temp.setAlpha(0.94);
        temp.clearTint();
        tempStrokes.forEach((stroke) => {
          stroke.setCrop();
          stroke.setAlpha(0.34);
        });
      } else {
        temp.setVisible(true);
        temp.setCrop();
        temp.clearTint();
        temp.setAlpha(1);
        tempStrokes.forEach((stroke) => {
          stroke.setCrop();
          stroke.setAlpha(0.34);
        });
      }

      this.activeMoveSprites.push(tempBase);
      this.activeMoveSprites.push(temp);
      tempStrokes.forEach((stroke) => {
        this.activeMoveSprites.push(stroke);
      });
      moveBatchSprites.push(tempBase, temp, ...tempStrokes);

      // Use physical distance to keep speed consistent and give motion a floatier cadence.
      const pixelDistance = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
      const duration = Phaser.Math.Clamp(Math.round(145 + pixelDistance * 0.9), 180, 420);

      this.tweens.add({
        targets: [tempBase, temp, ...tempStrokes],
        scaleX: ratio * 0.95,
        scaleY: ratio * 1.05,
        duration: Math.round(duration * 0.55),
        yoyo: true,
        ease: "Sine.easeInOut",
      });

      this.tweens.add({
        targets: [tempBase, temp, ...tempStrokes],
        x: to.x,
        y: to.y,
        angle: action.merge ? (action.fromX !== action.toX ? (action.fromX < action.toX ? 20 : -20) : (action.fromY < action.toY ? 20 : -20)) : 0,
        duration,
        ease: "Cubic.easeInOut",
        onComplete: () => {
          completed += 1;

          // Keep finished movers visible at destination until every mover is done.
          // This avoids brief "vanish" gaps when short moves finish before long ones.
          [tempBase, temp, ...tempStrokes].forEach((obj) => {
            if (obj && obj.active) {
              obj.setAngle(0);
            }
          });

          if (completed === smoothMoves.length) {
            this.isSlideAnimating = false;

            moveBatchSprites.forEach((obj) => {
              const activeIdx = this.activeMoveSprites.indexOf(obj);
              if (activeIdx >= 0) {
                this.activeMoveSprites.splice(activeIdx, 1);
              }
              if (obj && obj.active) {
                obj.destroy();
              }
            });

            this.refreshBoardView();

            if (merges.length) {
              this.pulseMergedSlots(merges, () => {
                this.refreshAll();
                onComplete();
              });
            } else {
              this.refreshAll();
              onComplete();
            }
          }
        },
      });
    });
  }

  pulseMergedSlots(merges, onDone) {
    this.cameras.main.shake(80, 0.002);

    merges.forEach((merge) => {
      const idx = merge.y * this.gridSize + merge.x;
      const rect = this.cellRects[idx];
      const spriteBase = this.tileSpritesBase[idx];
      const sprite = this.tileSprites[idx];

      this.killTweensForObjects([rect, spriteBase, sprite]);
      this.resetTileVisualTransform(idx);

      if (rect) {
        this.tweens.add({
          targets: rect,
          scaleX: 1.06,
          scaleY: 1.06,
          duration: 80,
          yoyo: true,
          ease: "Sine.easeInOut",
        });
      }

      if (sprite) {
        sprite.setAngle(0);
        this.tweens.add({
          targets: sprite,
          angle: 18,
          scaleX: sprite.scaleX * 1.15,
          scaleY: sprite.scaleY * 1.15,
          duration: 80,
          yoyo: true,
          ease: "Sine.easeInOut",
          onComplete: () => {
            sprite.setAngle(0);
          }
        });
      }
    });

    this.time.delayedCall(160, () => {
      merges.forEach((merge) => {
        this.resetTileVisualTransform(merge.y * this.gridSize + merge.x);
      });
      if (onDone) onDone();
    });
  }

  getCellCenter(x, y) {
    return {
      x: this.boardX + x * this.cellSize + (this.cellSize - 8) * 0.5,
      y: this.boardY + y * this.cellSize + (this.cellSize - 8) * 0.5,
    };
  }

  setMessage(text, color = "#9fc2dd") {
    this.messageText.setText(text);
    this.messageText.setColor(color);
  }

  getChargeCapForType(type) {
    if (type === "ice") {
      return this.iceChargeMax;
    }

    return this.burstThresholds[type] || 6;
  }

  updateIceFillFromMerges(merges) {
    const nonIceMerges = merges.filter((merge) => merge.type !== "ice").length;
    const hasAnyMerges = merges.length > 0;

    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const tile = this.board[y][x];
        if (!tile || tile.type !== "ice") {
          continue;
        }

        const current = tile.charge || 0;

        if (!hasAnyMerges) {
          tile.charge = Math.max(0, current - 0.5);
          continue;
        }

        if (nonIceMerges > 0) {
          tile.charge = Math.min(this.iceChargeMax, current + 0.5);
        }
      }
    }
  }

  isInside(x, y) {
    return x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize;
  }
}
