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

    this.decayShieldMoves = 0;
    this.noDecayNextMove = false;
    this.noCoffeeSpawnCharges = 0;
    this.scoreMultiplierMoves = 0;
    this.extraDecayMoves = 0;

    this.burstThresholds = {
      water: 4,
      juice: 5,
      tea: 5,
      cola: 4,
      coffee: 6,
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
      "ice",
    ];
    this.spawnsSinceIce = 0;

    this.cellRects = [];
    this.slotFillRects = [];
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
      panel: null,
      title: null,
      subtitle: null,
      sprite: null,
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

    this.spawnInitialTile();
    this.refreshAll();
  }

  setupModeValues() {
    if (this.tutorialMode) {
      this.iceCoreMax = 22;
      this.iceCore = 18;
    } else {
      this.iceCoreMax = 20;
      this.iceCore = 16;
    }
  }

  initializeState() {
    this.board = Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(null));
    this.freezeTurns = Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(0));

    this.turnCount = 0;
    this.score = 0;
    this.gameOver = false;
    this.isResolving = false;

    this.decayShieldMoves = 0;
    this.noDecayNextMove = false;
    this.noCoffeeSpawnCharges = 0;
    this.scoreMultiplierMoves = 0;
    this.extraDecayMoves = 0;

    this.spawnBag = [];
    this.spawnsSinceIce = 0;
    this.refillSpawnBag();
  }

  createLayout() {
    const { width } = this.scale;
    this.cameras.main.setBackgroundColor("#0e1620");

    const title = this.tutorialMode ? "FREEZE MERGE - TUTORIAL" : "FREEZE MERGE";

    this.add
      .text(width * 0.5, 22, title, {
        fontFamily: "Yoster",
        fontSize: "30px",
        color: "#ecf4ff",
      })
      .setOrigin(0.5);

    this.add
      .text(width * 0.5, 52, "Slide with Arrow keys or on-screen controls. Same drinks merge and charge slots.", {
        fontFamily: "Yoster",
        fontSize: "12px",
        color: "#9fb4c8",
      })
      .setOrigin(0.5);

    this.createBoardViews();
    this.createRightPanel();
    this.createControls();
    this.createCutInOverlay();

    this.setMessage("Merge same drinks to fill slot colors. Full slot triggers Freshen Up and bursts.");
  }

  createBoardViews() {
    this.cellRects = [];
    this.slotFillRects = [];
    this.slotFillCaps = [];
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

        const slotFill = this.add
          .rectangle(px + 4, py + this.cellSize - 6, this.cellSize - 16, 0, 0xffffff, 0.72)
          .setOrigin(0, 1)
          .setVisible(false);

        const sprite = this.add
          .image(px + (this.cellSize - 8) * 0.5, py + (this.cellSize - 8) * 0.5, "propWater")
          .setVisible(false);

        const slotFillCap = this.add
          .rectangle(px + 4, py + this.cellSize - 6, this.cellSize - 16, 2, 0xffffff, 0.95)
          .setOrigin(0, 1)
          .setVisible(false);

        const freezeText = this.add
          .text(px + 8, py + 10, "", {
            fontFamily: "Yoster",
            fontSize: "10px",
            color: "#95e9ff",
          })
          .setOrigin(0, 0.5);

        this.cellRects.push(rect);
        this.slotFillRects.push(slotFill);
        this.slotFillCaps.push(slotFillCap);
        this.tileSprites.push(sprite);
        this.freezeTexts.push(freezeText);
      }
    }
  }

  createRightPanel() {
    const { width } = this.scale;
    const panelX = width * 0.73;

    this.add.rectangle(panelX, 270, 245, 420, 0x152532, 0.65).setStrokeStyle(2, 0x355064, 1);

    this.iceCoreText = this.add
      .text(panelX, 100, "", {
        fontFamily: "Yoster",
        fontSize: "18px",
        color: "#d7f3ff",
      })
      .setOrigin(0.5);

    this.iceCoreBar = this.add.rectangle(panelX - 98, 126, 0, 14, 0x79ddff, 1).setOrigin(0, 0.5);
    this.add.rectangle(panelX, 126, 196, 14, 0x2a3b48, 1).setOrigin(0.5).setDepth(this.iceCoreBar.depth - 1);

    this.scoreText = this.add
      .text(panelX, 156, "", {
        fontFamily: "Yoster",
        fontSize: "15px",
        color: "#ffe59b",
      })
      .setOrigin(0.5);

    this.turnText = this.add
      .text(panelX, 178, "", {
        fontFamily: "Yoster",
        fontSize: "15px",
        color: "#dce9f5",
      })
      .setOrigin(0.5);

    this.messageText = this.add
      .text(panelX, 204, "", {
        fontFamily: "Yoster",
        fontSize: "11px",
        color: "#9fc2dd",
        align: "center",
        wordWrap: { width: 220 },
      })
      .setOrigin(0.5, 0);

    this.add
      .text(panelX, 255, "BURST THRESHOLDS", {
        fontFamily: "Yoster",
        fontSize: "12px",
        color: "#d4e6f4",
      })
      .setOrigin(0.5);

    this.add
      .text(panelX, 336, "Water 4  Juice 5\nTea 5  Cola 4\nCoffee 6", {
        fontFamily: "Yoster",
        fontSize: "12px",
        color: "#bcd0e2",
        align: "center",
      })
      .setOrigin(0.5);

    this.add
      .text(panelX, 384, "Slot fills by color as same items merge.\nWhen full, tile bursts and triggers skill.", {
        fontFamily: "Yoster",
        fontSize: "11px",
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

    this.cutIn.overlay = this.add.rectangle(width * 0.5, height * 0.5, width, height, 0x000000, 0).setDepth(250).setVisible(false);
    this.cutIn.panel = this.add.rectangle(-280, height * 0.5, 300, 220, 0x1c2f3f, 0.96).setDepth(251).setStrokeStyle(3, 0x8fc0dd, 1).setVisible(false);
    this.cutIn.title = this.add
      .text(-280, height * 0.5 - 50, "", {
        fontFamily: "Yoster",
        fontSize: "26px",
        color: "#f2fbff",
      })
      .setOrigin(0.5)
      .setDepth(252)
      .setVisible(false);

    this.cutIn.subtitle = this.add
      .text(-280, height * 0.5 + 56, "", {
        fontFamily: "Yoster",
        fontSize: "13px",
        color: "#d4e8f7",
      })
      .setOrigin(0.5)
      .setDepth(252)
      .setVisible(false);

    this.cutIn.sprite = this.add.image(-280, height * 0.5 + 6, "propCola").setDepth(252).setVisible(false);
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
    if (this.spawnsSinceIce >= 10) {
      this.spawnsSinceIce = 0;
      return "ice";
    }

    if (!this.spawnBag.length) {
      this.refillSpawnBag();
    }

    if (this.noCoffeeSpawnCharges > 0) {
      let index = this.spawnBag.findIndex((item) => item !== "coffee");
      if (index === -1) {
        this.refillSpawnBag();
        index = this.spawnBag.findIndex((item) => item !== "coffee");
      }
      if (index !== -1) {
        const [picked] = this.spawnBag.splice(index, 1);
        this.noCoffeeSpawnCharges = Math.max(0, this.noCoffeeSpawnCharges - 1);
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

    this.board[cell.y][cell.x] = {
      type,
      tier: 1,
      charge: 0,
    };

    if (type === "ice") {
      this.spawnsSinceIce = 0;
    } else {
      this.spawnsSinceIce += 1;
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
      this.setMessage("No movement.", "#ffb8a5");
      return;
    }

    this.isResolving = true;
    this.turnCount += 1;

    const moveMultiplier = this.scoreMultiplierMoves > 0 ? 2 : 1;
    if (this.scoreMultiplierMoves > 0) {
      this.scoreMultiplierMoves -= 1;
    }

    this.animateActions(result.actions, result.merges, () => {
      this.applyMoveDecay();
      this.resolveIceMerges(result.merges);
      this.updateIceFillFromMerges(result.merges);
      this.chargeScoreFromMerges(result.merges, moveMultiplier);

      const bursts = this.collectBurstTriggers(result.merges);
      this.resolveBurstQueue(bursts, () => {
        this.spawnOneTile();
        this.ensurePlayableState();
        this.tickFreezeTurns();

        this.refreshAll();
        this.checkLoseCondition();
        this.isResolving = false;
      });
    });
  }

  applyMoveDecay() {
    let decay = this.noDecayNextMove ? 0 : 1;

    if (this.noDecayNextMove) {
      this.noDecayNextMove = false;
    }

    if (this.decayShieldMoves > 0) {
      decay = Math.max(0, decay - 1);
      this.decayShieldMoves -= 1;
    }

    if (this.extraDecayMoves > 0) {
      decay += 1;
      this.extraDecayMoves -= 1;
    }

    this.iceCore = Math.max(0, this.iceCore - decay);
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
        this.board[merge.y][merge.x] = null;
        bursts.push({ type: merge.type, x: merge.x, y: merge.y, power: tile.tier });
      }
    });

    return bursts;
  }

  resolveBurstQueue(queue, onComplete) {
    if (!queue.length) {
      onComplete();
      return;
    }

    const burst = queue.shift();
    this.playFreshenCutIn(burst.type, () => {
      this.playSlotBurst(burst, () => {
        this.applySkill(burst.type);
        this.score += 120;
        this.refreshAll();
        this.resolveBurstQueue(queue, onComplete);
      });
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
        ring.destroy();
        flash.destroy();
        onDone();
      },
    });
  }

  playFreshenCutIn(type, done) {
    const { height } = this.scale;
    const names = {
      water: "PURIFY FLOW",
      juice: "SWEET CHILL",
      tea: "CALM INFUSION",
      cola: "CARBON BURST",
      coffee: "OVERCLOCK BREW",
    };

    const color = this.productColors[type];
    const startX = -280;
    const endX = 180;

    if (this.cache.audio.exists("freshenUpSfx")) {
      const freshenUpSfx = this.sound.add("freshenUpSfx", { volume: 0.78 });
      freshenUpSfx.once("complete", () => {
        freshenUpSfx.destroy();
      });
      freshenUpSfx.play();
    }

    this.cutIn.overlay.setVisible(true).setAlpha(0.35);
    this.cutIn.panel.setVisible(true).setPosition(startX, height * 0.5).setFillStyle(0x1c2f3f, 0.96).setStrokeStyle(3, color, 1);
    this.cutIn.title.setVisible(true).setPosition(startX, height * 0.5 - 50).setText("FRESHEN UP");
    this.cutIn.subtitle.setVisible(true).setPosition(startX, height * 0.5 + 56).setText(names[type]);
    this.cutIn.sprite
      .setVisible(true)
      .setTexture(this.itemSpriteKeys[type])
      .setPosition(startX, height * 0.5 + 6)
      .setScale(0.6);

    this.cameras.main.shake(type === "cola" ? 280 : 180, type === "cola" ? 0.004 : 0.0022);

    this.tweens.add({
      targets: [this.cutIn.panel, this.cutIn.title, this.cutIn.subtitle, this.cutIn.sprite],
      x: endX,
      duration: 300,
      ease: "Cubic.easeOut",
      onComplete: () => {
        if (type === "cola") {
          this.tweens.add({
            targets: this.cutIn.sprite,
            angle: { from: -6, to: 6 },
            duration: 85,
            yoyo: true,
            repeat: 5,
          });
        }

        this.time.delayedCall(520, () => {
          this.tweens.add({
            targets: [this.cutIn.panel, this.cutIn.title, this.cutIn.subtitle, this.cutIn.sprite],
            x: endX + 460,
            alpha: 0,
            duration: 280,
            ease: "Cubic.easeIn",
            onComplete: () => {
              this.cutIn.panel.setVisible(false).setAlpha(1);
              this.cutIn.title.setVisible(false).setAlpha(1);
              this.cutIn.subtitle.setVisible(false).setAlpha(1);
              this.cutIn.sprite.setVisible(false).setAlpha(1).setAngle(0);
              this.cutIn.overlay.setVisible(false);
              done();
            },
          });
        });
      },
    });
  }

  applySkill(type) {
    if (type === "water") {
      this.decayShieldMoves += 3;
      this.setMessage("Water burst: decay reduced for 3 moves.", "#9fd4ff");
      return;
    }

    if (type === "juice") {
      this.iceCore = Math.min(this.iceCoreMax, this.iceCore + 2);
      this.makeMergeReadyPair();
      this.setMessage("Juice burst: +2 Ice Core and merge setup.", "#ffc4a8");
      return;
    }

    if (type === "tea") {
      this.noDecayNextMove = true;
      this.noCoffeeSpawnCharges += 1;
      this.setMessage("Tea burst: next move no decay, coffee blocked next spawn.", "#b8efaf");
      return;
    }

    if (type === "cola") {
      this.applyColaBurst();
      this.setMessage("Cola burst: downgraded nearby tiles.", "#ffb3b3");
      return;
    }

    if (type === "coffee") {
      this.scoreMultiplierMoves += 2;
      this.extraDecayMoves += 2;
      this.setMessage("Coffee burst: x2 score for 2 moves, extra Ice decay.", "#ddc0aa");
    }
  }

  makeMergeReadyPair() {
    const pairs = this.getAdjacentPairs();
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

  applyColaBurst() {
    let source = null;

    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const tile = this.board[y][x];
        if (!tile || tile.type !== "cola") {
          continue;
        }

        if (!source || tile.tier > source.tier) {
          source = { x, y, tier: tile.tier };
        }
      }
    }

    if (!source) {
      return;
    }

    const targets = [
      [source.x + 1, source.y],
      [source.x - 1, source.y],
      [source.x, source.y + 1],
      [source.x, source.y - 1],
    ];

    targets.forEach(([x, y]) => {
      if (!this.isInside(x, y)) {
        return;
      }

      const tile = this.board[y][x];
      if (!tile) {
        return;
      }

      if (tile.tier <= 1) {
        this.board[y][x] = { type: "water", tier: 1, charge: 0 };
      } else {
        tile.tier -= 1;
      }
    });
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

        if (next.type === tile.type) {
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

  ensurePlayableState() {
    if (this.hasLegalMove()) {
      return;
    }

    const pair = Phaser.Utils.Array.GetRandom(this.getAdjacentPairs());
    this.board[pair.a.y][pair.a.x] = { type: "ice", tier: 1, charge: 0 };
    this.board[pair.b.y][pair.b.x] = { type: "ice", tier: 1, charge: 0 };
    this.freezeTurns[pair.a.y][pair.a.x] = 0;
    this.freezeTurns[pair.b.y][pair.b.x] = 0;

    this.setMessage("Safety system injected Ice pair to prevent deadlock.", "#9fdbff");
  }

  hasLegalMove() {
    if (this.getEmptyCells().length > 0) {
      return true;
    }

    for (let y = 0; y < this.gridSize; y += 1) {
      for (let x = 0; x < this.gridSize; x += 1) {
        const tile = this.board[y][x];
        if (!tile) {
          continue;
        }

        const neighbors = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ];

        for (let i = 0; i < neighbors.length; i += 1) {
          const [nx, ny] = neighbors[i];
          if (!this.isInside(nx, ny)) {
            continue;
          }
          const other = this.board[ny][nx];
          if (other && other.type === tile.type) {
            return true;
          }
        }
      }
    }

    return false;
  }

  checkLoseCondition() {
    if (this.iceCore > 0) {
      return;
    }

    this.gameOver = true;
    this.setMessage("Ice Core melted. Press RESTART.", "#ff9f9f");
    this.cameras.main.shake(260, 0.004);
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
        const slotFill = this.slotFillRects[idx];
        const slotFillCap = this.slotFillCaps[idx];
        const sprite = this.tileSprites[idx];
        const freezeText = this.freezeTexts[idx];

        if (!tile) {
          rect.setFillStyle(0x1c2a36, 1);
          rect.setStrokeStyle(2, 0x395365, 1);
          slotFill.setVisible(false);
          slotFillCap.setVisible(false);
          sprite.setVisible(false);
          freezeText.setText("");
          continue;
        }

        const color = this.productColors[tile.type] || 0x8fa7ba;
        rect.setFillStyle(color, 0.16);
        rect.setStrokeStyle(2, color, 1);

        const threshold = this.burstThresholds[tile.type] || 6;
        const charge = tile.charge || 0;
        const cap = this.getChargeCapForType(tile.type);
        const ratio = Phaser.Math.Clamp(charge / cap, 0, 1);
        const maxHeight = this.cellSize - 16;
        const minVisibleHeight = 10;
        const height = ratio > 0 ? Math.max(minVisibleHeight, maxHeight * ratio) : 0;
        const fillY = this.boardY + y * this.cellSize + this.cellSize - 6;

        if (height <= 0) {
          slotFill.setVisible(false);
          slotFillCap.setVisible(false);
        } else {
          slotFill.setVisible(true);
          slotFill.setPosition(this.boardX + x * this.cellSize + 4, fillY);
          slotFill.setFillStyle(color, 0.78);
          slotFill.setDisplaySize(this.cellSize - 16, height);
          slotFill.setDepth(sprite.depth + 1);

          slotFillCap.setVisible(true);
          slotFillCap.setPosition(this.boardX + x * this.cellSize + 4, fillY - height + 2);
          slotFillCap.setDisplaySize(this.cellSize - 16, 2);
          slotFillCap.setFillStyle(0xffffff, 0.95);
          slotFillCap.setDepth(sprite.depth + 2);
        }

        this.placeTileSprite(sprite, tile.type);
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

    this.tileSprites.forEach((sprite) => {
      sprite.setAlpha(0.45);
    });

    let completed = 0;

    moving.forEach((action) => {
      const from = this.getCellCenter(action.fromX, action.fromY);
      const to = this.getCellCenter(action.toX, action.toY);

      const temp = this.add.image(from.x, from.y, this.itemSpriteKeys[action.type]).setDepth(220);
      const source = temp.texture.getSourceImage();
      const ratio = Math.min(54 / (source.width || 1), 66 / (source.height || 1));
      temp.setScale(ratio);

      this.tweens.add({
        targets: temp,
        x: to.x,
        y: to.y,
        duration: 150,
        ease: "Quad.easeOut",
        onComplete: () => {
          completed += 1;
          temp.destroy();

          if (completed === moving.length) {
            this.tileSprites.forEach((sprite) => {
              sprite.setAlpha(1);
            });

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

