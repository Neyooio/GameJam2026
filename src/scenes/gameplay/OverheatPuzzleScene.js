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
    this.slotFillRects = [];
    this.slotFillGlows = [];
    this.slotFillShines = [];
    this.slotFillCaps = [];
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

    this.customerSprite = null;
    this.customerBubble = null;
    this.customerText = null;
  }

  init(data) {
    this.tutorialMode = Boolean(data && data.tutorial);
  }

  create() {
    this.setupModeValues();
    this.initializeState();
    this.createLayout();
    this.bindInput();

    this.spawnInitialTile();
    this.normalizeIceState();
    this.refreshAll();
  }

  update(time, delta) {
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

    this.coffeePassiveInterval = 3;

    this.customerActive = false;
    this.customerWantedType = null;
    this.customerCooldown = 5;

    this.spawnBag = [];
    this.refillSpawnBag();
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
    // The wires are located on the far right edge of the vending machine.
    // Approximate bounding boxes for the top and bottom wire sets based on the background art:
    const wireAreas = [
      { minX: 890, maxX: 930, minY: 280, maxY: 330 },
      { minX: 890, maxX: 930, minY: 440, maxY: 490 }
    ];

    const spawnSparkBurst = () => {
      // Safety check in case scene was destroyed
      if (!this.sys || !this.sys.game || !this.add || !this.time) return;

      const area = Phaser.Utils.Array.GetRandom(wireAreas);
      const x = Phaser.Math.Between(area.minX, area.maxX);
      const y = Phaser.Math.Between(area.minY, area.maxY);

      const sparkCount = Phaser.Math.Between(8, 15);
      for (let i = 0; i < sparkCount; i++) {
        const sparkSize = Phaser.Math.Between(1, 3);
        const color = Math.random() > 0.4 ? 0xffffff : 0x79ddff;
        const spark = this.add.rectangle(x, y, sparkSize, sparkSize, color).setDepth(20);

        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const speed = Phaser.Math.FloatBetween(20, 60);
        const targetX = x + Math.cos(angle) * speed;
        const targetY = y + Math.sin(angle) * speed + 40; // gravity effect

        this.tweens.add({
          targets: spark,
          x: targetX,
          y: targetY,
          alpha: 0,
          rotation: Phaser.Math.FloatBetween(-Math.PI * 2, Math.PI * 2),
          duration: Phaser.Math.Between(300, 700),
          ease: "Power1",
          onComplete: () => {
            if (spark) spark.destroy();
          }
        });
      }

      // 10 times per minute means every ~6000ms
      this.time.delayedCall(Phaser.Math.Between(5000, 7000), spawnSparkBurst);
    };

    // Schedule the first burst
    this.time.delayedCall(Phaser.Math.Between(2000, 5000), spawnSparkBurst);
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

  createBoardViews() {
    this.cellRects = [];
    this.tileSpritesStrokes = [];
    this.tileSpritesBase = [];
    this.tileSprites = [];
    this.freezeTexts = [];

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
    this.customerSprite = this.add.image(this.customerSpriteBaseX, this.customerSpriteBaseY, "charStudent").setVisible(false).setDepth(8).setOrigin(0.5, 0);
    const src = this.customerSprite.texture.getSourceImage();
    if (src && src.height) {
      const halfHeight = src.height * 0.55;
      this.customerSprite.setCrop(0, 0, src.width, halfHeight);
      this.customerSprite.setScale(90 / halfHeight);
    } else {
      this.customerSprite.setScale(0.3);
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
    });
  }

  spawnInitialTile() {
    this.spawnOneTile("ice");
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
    if (this.gameOver || this.isResolving) {
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

    this.animateActions(result.actions, result.merges, () => {
      const waterMergeCount = result.merges.filter((merge) => merge.type === "water").length;
      if (waterMergeCount > 0) {
        this.chargeAllCoffeeBy(waterMergeCount);
      }

      this.applyMoveDecay(result.merges.length > 0);
      this.resolveIceMerges(result.merges);
      this.updateIceFillFromMerges(result.merges);
      this.chargeScoreFromMerges(result.merges, 1);

      const bursts = this.collectBurstTriggers(result.merges);
      this.resolveBurstQueue(bursts, () => {
        this.spawnOneTile();
        this.applyCoffeePassive();
        this.tickFreezeTurns();
        this.updateCustomer();
        this.normalizeIceState();
        this.checkLoseCondition(() => {
          this.refreshAll();
          this.isResolving = false;
        });
      });
    });
  }

  applyMoveDecay(hadMerge = false) {
    if (hadMerge) {
      return;
    }

    this.iceCore = Math.max(0, this.iceCore - 1);
  }

  resolveIceMerges(merges) {
    merges.forEach((merge) => {
      if (merge.type !== "ice") {
        return;
      }

      const restore = 2 + Math.max(1, Math.floor(merge.resultTier * 0.5));
      this.iceCore = Math.min(this.iceCoreMax, this.iceCore + restore);
      this.score += 50;
      this.applyIceFreezeGuard();
    });
  }

  chargeScoreFromMerges(merges, scoreMultiplier) {
    merges.forEach((merge) => {
      this.score += (5 + merge.resultTier * 3) * scoreMultiplier;
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
      if (!tile) {
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
        if (!tile || tile.type === "ice") {
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

  resolveBurstQueue(queue, onComplete, playedCutIns = new Set()) {
    if (!queue.length) {
      onComplete();
      return;
    }

    const burst = queue.shift();

    const runBurstLogic = () => {
      this.playBurstPreShake(burst, () => {
        const afterPreShake = () => {
          this.playSlotBurst(burst, () => {
            this.applySkill(burst.type, burst);
            this.score += 120;
            this.refreshAll();
            this.resolveBurstQueue(queue, onComplete, playedCutIns);
          });
        };

        if (burst.type === "cola") {
          this.playColaPreShake(burst, afterPreShake);
        } else {
          afterPreShake();
        }
      });
    };

    if (!playedCutIns.has(burst.type)) {
      playedCutIns.add(burst.type);
      this.playFreshenCutIn(burst.type, runBurstLogic);
    } else {
      runBurstLogic();
    }
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

    if (this.cache.audio.exists("freshenUpSfx")) {
      const freshenUpSfx = this.sound.add("freshenUpSfx", { volume: 0.78 });
      freshenUpSfx.once("complete", () => {
        freshenUpSfx.destroy();
      });
      freshenUpSfx.play();
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

  applySkill(type, burst = null) {
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
      this.iceCore = Math.min(this.iceCoreMax, this.iceCore + 1);
      this.setMessage("Coffee burst: removed itself, Ice Core +1.", "#ddc0aa");
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
        targets: [this.customerSprite, this.customerBubble, this.customerText],
        alpha: 0,
        duration: 300,
        onComplete: () => {
          this.customerSprite.setVisible(false);
          this.customerBubble.setVisible(false);
          this.customerText.setVisible(false);
          if (this.customerBobTween) {
            this.customerBobTween.stop();
            this.customerBobTween = null;
          }
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
      if (!tile) {
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
        if (tile && tile.type === "tea") {
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
      if (!tile) {
        return;
      }

      if (tile.type === "ice") {
        this.iceCore = Math.max(0, this.iceCore - 3);
        return;
      }

      this.board[y][x] = null;
      this.freezeTurns[y][x] = 0;
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
    if (source && this.convertRandomSlotToCoffee()) {
      this.resetAllCoffeeSpreadCounters();
      this.setMessage("Coffee passive: one coffee spread. Counters reset.", "#ddc0aa");
    }
  }

  getCoffeeTiles() {
    const coffees = [];
    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const tile = this.board[y][x];
        if (tile && tile.type === "coffee") {
          coffees.push({ x, y, tile });
        }
      }
    }

    return coffees;
  }

  convertRandomSlotToCoffee() {
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

        candidates.push({ x, y });
      }
    }

    if (!candidates.length) {
      return false;
    }

    const chosen = Phaser.Utils.Array.GetRandom(candidates);
    this.board[chosen.y][chosen.x] = { type: "coffee", tier: 1, charge: 0, coffeeSpreadCounter: 0 };
    this.freezeTurns[chosen.y][chosen.x] = 0;
    return true;
  }

  chargeAllCoffeeBy(amount = 1) {
    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const tile = this.board[y][x];
        if (!tile || tile.type !== "coffee") {
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
        if (!tile || tile.type !== "water") {
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

  applyIceFreezeGuard() {
    const candidates = [];

    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        if (this.board[y][x]) {
          candidates.push({ x, y });
        }
      }
    }

    if (!candidates.length) {
      return;
    }

    const chosen = Phaser.Utils.Array.GetRandom(candidates);
    this.freezeTurns[chosen.y][chosen.x] = 1;
  }

  tickFreezeTurns() {
    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        if (this.freezeTurns[y][x] > 0) {
          this.freezeTurns[y][x] -= 1;
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
          this.board[ny][nx] = tile;
          this.board[y][x] = null;

          this.freezeTurns[ny][nx] = this.freezeTurns[y][x];
          this.freezeTurns[y][x] = 0;

          actions.push({ type: tile.type, fromX: x, fromY: y, toX: nx, toY: ny });

          passMoved = true;
          moved = true;
          return;
        }

        if (merged[ny][nx]) {
          return;
        }

        if (next.type === tile.type && tile.type !== "coffee") {
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
          actions.push({ type: tile.type, fromX: x, fromY: y, toX: nx, toY: ny, merge: true });

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
      if (!next || (next.type === tile.type && tile.type !== "coffee")) {
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
    this.refreshBoardView();
    this.refreshHud();
  }

  refreshBoardView() {
    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const idx = y * this.gridSize + x;
        const tile = this.board[y][x];

        const rect = this.cellRects[idx];
        const strokes = this.tileSpritesStrokes[idx];
        const spriteBase = this.tileSpritesBase[idx];
        const sprite = this.tileSprites[idx];
        const freezeText = this.freezeTexts[idx];

        if (!tile) {
          rect.setFillStyle(0x1c2a36, 1);
          rect.setStrokeStyle(2, 0x395365, 1);
          strokes.forEach(s => s.setVisible(false));
          spriteBase.setVisible(false);
          sprite.setVisible(false);
          freezeText.setText("");
          continue;
        }

        const color = this.productColors[tile.type] || 0x8fa7ba;
        rect.setFillStyle(0x1c2a36, 1);
        rect.setStrokeStyle(2, color, 1);

        const threshold = this.burstThresholds[tile.type] || 6;
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

        const source = sprite.texture.getSourceImage();
        const sourceHeight = source.height || 1;
        const sourceWidth = source.width || 1;

        if (ratio <= 0) {
          sprite.setVisible(false);
        } else {
          sprite.setVisible(true);
          const cropHeight = Math.max(1, sourceHeight * ratio);
          const cropY = sourceHeight - cropHeight;
          sprite.setCrop(0, cropY, sourceWidth, cropHeight);
        }

        freezeText.setText(this.freezeTurns[y][x] > 0 ? "F" : "");
      }
    }
  }

  placeTileSprite(sprite, type) {
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
    this.turnText.setText(`Turns: ${this.turnCount}`);

    const ratio = Phaser.Math.Clamp(this.iceCore / this.iceCoreMax, 0, 1);
    this.iceCoreBar.setDisplaySize(196 * ratio, 14);

    const coreColor = this.iceCore <= 5 ? 0xff7f7f : this.iceCore <= 10 ? 0xffd77f : 0x79ddff;
    this.iceCoreBar.setFillStyle(coreColor, 1);
  }

  animateActions(actions, merges, onComplete) {
    const moving = actions.filter((action) => action.fromX !== action.toX || action.fromY !== action.toY);
    if (!moving.length) {
      if (merges.length) {
        this.pulseMergedSlots(merges);
      }
      onComplete();
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
        });
      } else {
        consolidated.set(key, { ...action });
      }
    });

    const smoothMoves = Array.from(consolidated.values());

    smoothMoves.forEach((action) => {
      const idx = action.fromY * this.gridSize + action.fromX;
      if (this.tileSpritesBase[idx]) this.tileSpritesBase[idx].setVisible(false);
      if (this.tileSprites[idx]) this.tileSprites[idx].setVisible(false);
      if (this.tileSpritesStrokes[idx]) {
        this.tileSpritesStrokes[idx].forEach((s) => s.setVisible(false));
      }
    });

    let completed = 0;

    smoothMoves.forEach((action) => {
      const from = this.getCellCenter(action.fromX, action.fromY);
      const to = this.getCellCenter(action.toX, action.toY);

      const temp = this.add.image(from.x, from.y, this.itemSpriteKeys[action.type]).setDepth(220);
      const source = temp.texture.getSourceImage();
      const ratio = Math.min(54 / (source.width || 1), 66 / (source.height || 1));
      temp.setScale(ratio);

      // Scale duration by distance so longer slides feel natural
      const dist = Math.abs(action.toX - action.fromX) + Math.abs(action.toY - action.fromY);
      const duration = 120 + dist * 40;

      this.tweens.add({
        targets: temp,
        x: to.x,
        y: to.y,
        duration,
        ease: "Cubic.easeOut",
        onComplete: () => {
          completed += 1;
          temp.destroy();

          if (completed === smoothMoves.length) {
            if (merges.length) {
              this.pulseMergedSlots(merges);
            }
            onComplete();
          }
        },
      });
    });
  }

  pulseMergedSlots(merges) {
    this.cameras.main.shake(80, 0.002);

    merges.forEach((merge) => {
      const idx = merge.y * this.gridSize + merge.x;
      const rect = this.cellRects[idx];
      if (!rect) {
        return;
      }

      this.tweens.add({
        targets: rect,
        scaleX: 1.06,
        scaleY: 1.06,
        duration: 80,
        yoyo: true,
        ease: "Sine.easeInOut",
      });
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
